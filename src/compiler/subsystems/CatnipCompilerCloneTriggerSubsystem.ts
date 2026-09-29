import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipSpriteID } from "../../runtime/CatnipSprite";
import { CatnipWasmStructTarget } from "../../wasm-interop/CatnipWasmStructTarget";
import { CatnipCompiler } from "../CatnipCompiler";
import { CatnipCompilerSubsystem } from "../CatnipCompilerSubsystem";
import { CatnipCompilerWasmGenContext } from "../CatnipCompilerWasmGenContext";
import { CatnipTriggerFunctionGenerator, CATNIP_THREAD_START_ALWAYS } from "../CatnipTriggerGenerator";
import { CatnipIrScriptCloneTrigger } from "../ir/event/clone_trigger";
import { SpiderFunctionDefinition, SpiderLocalReference } from "wasm-spider";

/**
 * Fan-out for "when I start as clone": one generator per sprite, started with
 * the fresh clone's pointer as the only argument. scratch-vm's
 * initDrawable does runtime.startHats('control_start_as_clone', null, this)
 * right after makeClone, so only the new clone's own hat threads start —
 * exactly what the targetParam generator does — and the hat declares
 * restartExistingThreads: false, which is the ALWAYS start mode.
 */
export class CatnipCompilerCloneTriggerSubsystem extends CatnipCompilerSubsystem {
    private readonly _spriteMap: Map<CatnipSpriteID, CatnipTriggerFunctionGenerator>;
    private readonly _startFunctions: Map<CatnipSpriteID, SpiderFunctionDefinition>;

    public constructor(compiler: CatnipCompiler) {
        super(compiler);
        this._spriteMap = new Map();
        this._startFunctions = new Map();
    }

    public addTrigger(trigger: CatnipIrScriptCloneTrigger) {
        let generator = this._spriteMap.get(trigger.ir.spriteID);

        if (generator === undefined) {
            generator = new CatnipTriggerFunctionGenerator(this.compiler, false, CATNIP_THREAD_START_ALWAYS, true);
            this._spriteMap.set(trigger.ir.spriteID, generator);
        }

        generator.addTrigger(trigger);
    }

    /**
     * Emits the dispatch run right after a clone is created (into whatever
     * wasm expression the caller has open): when the clone belongs to a
     * sprite that has "when I start as clone" hats, its generator starts
     * them on this target. Conditions are exclusive — one clone has one
     * sprite — so the checks simply fall through.
     */
    public emitStartCalls(ctx: CatnipCompilerWasmGenContext, clone: SpiderLocalReference): void {
        for (const [spriteID, generator] of this._spriteMap) {
            const sprite = this.compiler.project.getSprite(spriteID);
            let startFunction = this._startFunctions.get(spriteID);

            if (startFunction === undefined) {
                startFunction = generator.createEventFunction();
                this._startFunctions.set(spriteID, startFunction);
            }

            ctx.emitWasm(SpiderOpcodes.local_get, clone);
            ctx.emitWasm(SpiderOpcodes.i32_load, 2, CatnipWasmStructTarget.getMemberOffset("sprite"));
            ctx.emitWasmConst(SpiderNumberType.i32, sprite.structWrapper.ptr);
            ctx.emitWasm(SpiderOpcodes.i32_eq);

            ctx.pushExpression();
            ctx.emitWasm(SpiderOpcodes.local_get, clone);
            ctx.emitWasm(SpiderOpcodes.call, startFunction);
            ctx.emitWasm(SpiderOpcodes.if, ctx.popExpression());
        }
    }
}
