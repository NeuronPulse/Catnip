import { SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipSpriteID } from "../../runtime/CatnipSprite";
import { CatnipWasmStructTarget } from "../../wasm-interop/CatnipWasmStructTarget";
import { CatnipCompiler } from "../CatnipCompiler";
import { CatnipCompilerSubsystem } from "../CatnipCompilerSubsystem";
import { CatnipTriggerFunctionGenerator, CATNIP_THREAD_START_RESTART } from "../CatnipTriggerGenerator";
import { CatnipIrScriptClickTrigger } from "../ir/event/click_trigger";

/**
 * Fan-out for the IO_CLICK_TARGET event: one listener for every click hat
 * in the project, given the pointer of the picked target. The sprite of
 * that target decides whose hats fire — both click opcodes share this
 * mechanism, exactly like scratch-vm's mouse._activateClickHats, which
 * starts both hat types on the same target.
 */
export class CatnipCompilerClickTriggerSubsystem extends CatnipCompilerSubsystem {
    private readonly _spriteMap: Map<CatnipSpriteID, CatnipTriggerFunctionGenerator>;

    public constructor(compiler: CatnipCompiler) {
        super(compiler);
        this._spriteMap = new Map();
    }

    public addTrigger(trigger: CatnipIrScriptClickTrigger) {
        let generator = this._spriteMap.get(trigger.ir.spriteID);

        if (generator === undefined) {
            // scratch-vm's getHats declares restartExistingThreads: true
            // for both click opcodes — a click while the hat's script runs
            // restarts it instead of stacking another run.
            generator = new CatnipTriggerFunctionGenerator(this.compiler, false, CATNIP_THREAD_START_RESTART, true);
            this._spriteMap.set(trigger.ir.spriteID, generator);
        }

        generator.addTrigger(trigger);
    }

    public addEvents(): void {
        if (this._spriteMap.size === 0) return;

        const eventFunction = this.spiderModule.createFunction({
            parameters: [SpiderNumberType.i32] // target pointer
        });

        eventFunction.body.emitBlock(body => {
            for (const [spriteID, generator] of this._spriteMap) {
                const sprite = this.compiler.project.getSprite(spriteID);
                const startFunction = generator.createEventFunction();

                body.emit(SpiderOpcodes.local_get, eventFunction.getParameter(0));
                body.emit(SpiderOpcodes.i32_load, 2, CatnipWasmStructTarget.getMemberOffset("sprite"));
                body.emitConstant(SpiderNumberType.i32, sprite.structWrapper.ptr);
                body.emit(SpiderOpcodes.i32_eq);

                body.emitIf(ifTrue => {
                    ifTrue.emit(SpiderOpcodes.local_get, eventFunction.getParameter(0));
                    ifTrue.emit(SpiderOpcodes.call, startFunction);
                    // One target belongs to one sprite; skip the rest.
                    ifTrue.emit(SpiderOpcodes.br, 1);
                });
            }
        });

        this.compiler.addEventListener("IO_CLICK_TARGET", eventFunction);
    }
}
