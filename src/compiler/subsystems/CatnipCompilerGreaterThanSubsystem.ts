import { CatnipCompiler } from "../CatnipCompiler";
import { CatnipCompilerSubsystem } from "../CatnipCompilerSubsystem";
import { CatnipTriggerFunctionGenerator, CATNIP_THREAD_START_SKIP_IF_RUNNING } from "../CatnipTriggerGenerator";
import { CatnipIrScriptGreaterThanTrigger } from "../ir/event/greaterthan_trigger";

/**
 * The event_whengreaterthan hats ("when timer > N"). Their trigger function
 * is registered as a PROJECT_FRAME listener that CatnipProjectModule.step()
 * fires before every tick, mirroring how scratch-vm's _step calls startHats
 * for every edge-activated hat ahead of sequencer.stepThreads. The
 * skip-if-running start mode is the hat's restartExistingThreads: false —
 * while the hat's script still has a live thread, the press is ignored.
 */
export class CatnipCompilerGreaterThanSubsystem extends CatnipCompilerSubsystem {
    private readonly _generator: CatnipTriggerFunctionGenerator;
    private _keyCounter: number;

    public constructor(compiler: CatnipCompiler) {
        super(compiler);
        this._generator = new CatnipTriggerFunctionGenerator(compiler, false, CATNIP_THREAD_START_SKIP_IF_RUNNING);
        this._keyCounter = 0;
    }

    /** A per-compile id under which each target stores the hat's edge value. */
    public allocateKey(): number {
        return this._keyCounter++;
    }

    public registerTrigger(trigger: CatnipIrScriptGreaterThanTrigger): void {
        this._generator.addTrigger(trigger);
    }

    public addEvents(): void {
        if (this._keyCounter === 0) return;
        this.compiler.addEventListener("PROJECT_FRAME", this._generator.createEventFunction());
    }
}
