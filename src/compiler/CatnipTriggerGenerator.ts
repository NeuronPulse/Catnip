import { SpiderFunctionDefinition, SpiderLocalParameterReference, SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipSpriteID } from "../runtime/CatnipSprite";
import { CatnipWasmStructRuntime } from "../wasm-interop/CatnipWasmStructRuntime";
import { CatnipWasmStructTarget } from "../wasm-interop/CatnipWasmStructTarget";
import { CatnipCompiler } from "./CatnipCompiler";
import { CatnipIrScriptTrigger } from "./CatnipIrScriptTrigger";
import { CatnipCompilerLogger } from "./CatnipCompilerLogger";

/** Mirrors CATNIP_THREAD_START_* in module/catnip_target.h. */
export const CATNIP_THREAD_START_ALWAYS = 0;
export const CATNIP_THREAD_START_RESTART = 1;
export const CATNIP_THREAD_START_SKIP_IF_RUNNING = 2;

/**
 * Generates a function which starts threads.
 * All triggers are added to it, then it generates a function which
 *  starts each script attached to those triggers.
 */
export class CatnipTriggerFunctionGenerator {
    public readonly compiler: CatnipCompiler;
    public readonly triggers: Map<CatnipSpriteID, CatnipIrScriptTrigger[]>;
    public readonly triggerFunction: SpiderFunctionDefinition;
    public readonly writeThreadList: boolean;
    public readonly startMode: number;
    /**
     * When set, the generated function takes the clicked target's pointer as
     * its only parameter and starts every trigger on that very target,
     * without walking the global target list (the caller already picked the
     * target for us).
     */
    public readonly targetParam: boolean;

    private _generated: boolean;

    public constructor(compiler: CatnipCompiler, writeThreadList: boolean, startMode: number, targetParam: boolean = false) {
        CatnipCompilerLogger.assert(!writeThreadList || !targetParam, true, "writeThreadList and targetParam cannot both be set.");
        this.compiler = compiler;
        this.triggers = new Map();
        this.triggerFunction = this.compiler.spiderModule.createFunction();
        this._generated = false;
        this.writeThreadList = writeThreadList;
        this.startMode = startMode;
        this.targetParam = targetParam;

        if (this.writeThreadList || this.targetParam) {
            this.triggerFunction.addParameter(SpiderNumberType.i32);
        }
    }

    public addTrigger(trigger: CatnipIrScriptTrigger) {
        CatnipCompilerLogger.assert(!this._generated, true, "Function already generated.");
        let triggers = this.triggers.get(trigger.ir.spriteID);

        if (triggers === undefined) {
            triggers = [];
            this.triggers.set(trigger.ir.spriteID, triggers);
        }

        triggers.push(trigger);
        triggers.sort((a, b) => a.inputs.priority - b.inputs.priority);
    }

    public createEventFunction(): SpiderFunctionDefinition {
        CatnipCompilerLogger.assert(!this._generated, true, "Function already generated.");

        if (this.targetParam) {
            // The caller already picked the target: start every trigger of
            // this sprite directly on it.
            const targetVarRef = this.triggerFunction.getParameter(0);
            for (const triggers of this.triggers.values()) {
                for (const trigger of triggers) {
                    this.triggerFunction.body.emit(SpiderOpcodes.local_get, targetVarRef);
                    this.triggerFunction.body.emitConstant(SpiderNumberType.i32, trigger.ir.entrypoint.functionTableIndex);
                    this.triggerFunction.body.emitConstant(SpiderNumberType.i32, 0);
                    this.triggerFunction.body.emitConstant(SpiderNumberType.i32, this.startMode);
                    this.triggerFunction.body.emit(SpiderOpcodes.call, this.compiler.getRuntimeFunction("catnip_target_start_thread"));
                }
            }
            return this.triggerFunction;
        }

        let threadListPtrVarRef: SpiderLocalParameterReference;

        if (this.writeThreadList) {
            threadListPtrVarRef = this.triggerFunction.getParameter(0);
        }

        const targetVarRef = this.triggerFunction.addLocalVariable(SpiderNumberType.i32);

        this.triggerFunction.body.emitConstant(SpiderNumberType.i32, this.compiler.runtimeInstance.ptr);
        this.triggerFunction.body.emit(SpiderOpcodes.i32_load, 2, CatnipWasmStructRuntime.getMemberOffset("targets"));
        this.triggerFunction.body.emit(SpiderOpcodes.local_set, targetVarRef);

        this.triggerFunction.body.emitBlock(block => {
            block.emitLoop(loop => {
                // Break if target is null
                loop.emit(SpiderOpcodes.local_get, targetVarRef);
                loop.emit(SpiderOpcodes.i32_eqz);
                loop.emit(SpiderOpcodes.br_if, 1);

                // Get the pointer to the sprite of this target
                const spriteVarRef = this.triggerFunction!.addLocalVariable(SpiderNumberType.i32);
                loop.emit(SpiderOpcodes.local_get, targetVarRef);
                loop.emit(SpiderOpcodes.i32_load, 2, CatnipWasmStructTarget.getMemberOffset("sprite"));
                loop.emit(SpiderOpcodes.local_set, spriteVarRef);

                loop.emitBlock(innerBlock => {
                    for (const [spriteID, triggers] of this.triggers) {
                        const sprite = this.compiler.project.getSprite(spriteID);

                        // Check to see if this target is an instance of the sprite
                        innerBlock.emit(SpiderOpcodes.local_get, spriteVarRef);
                        innerBlock.emitConstant(SpiderNumberType.i32, sprite.structWrapper.ptr);
                        innerBlock.emit(SpiderOpcodes.i32_eq);

                        innerBlock.emitIf(ifTrue => {
                            // If it is, create the threads
                            for (const trigger of triggers) {
                                ifTrue.emit(SpiderOpcodes.local_get, targetVarRef);
                                ifTrue.emitConstant(SpiderNumberType.i32, trigger.ir.entrypoint.functionTableIndex);
                                if (this.writeThreadList) ifTrue.emit(SpiderOpcodes.local_get, threadListPtrVarRef);
                                else ifTrue.emitConstant(SpiderNumberType.i32, 0);
                                ifTrue.emitConstant(SpiderNumberType.i32, this.startMode);
                                ifTrue.emit(SpiderOpcodes.call, this.compiler.getRuntimeFunction("catnip_target_start_thread"));
                            }
                            // Skip to the end of "innerBlock"
                            ifTrue.emit(SpiderOpcodes.br, 1);
                        });
                    }
                });

                // Get the pointer to the next target
                loop.emit(SpiderOpcodes.local_get, targetVarRef);
                loop.emit(SpiderOpcodes.i32_load, 2, CatnipWasmStructTarget.getMemberOffset("next_global"));
                loop.emit(SpiderOpcodes.local_set, targetVarRef);

                loop.emit(SpiderOpcodes.br, 0);
            });
        });

        return this.triggerFunction;
    }
}
