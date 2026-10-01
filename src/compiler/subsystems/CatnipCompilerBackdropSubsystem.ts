import { SpiderFunction, SpiderFunctionDefinition, SpiderNumberType, SpiderOpcodes } from "wasm-spider";
import { CatnipCompiler } from "../CatnipCompiler";
import { CatnipCompilerSubsystem } from "../CatnipCompilerSubsystem";
import { CatnipIrScriptBackdropSwitchTrigger } from "../ir/event/backdrop_switch_trigger";
import { CatnipTriggerFunctionGenerator, CATNIP_THREAD_START_RESTART } from "../CatnipTriggerGenerator";

interface BackdropSwitchTriggerInfo {
    triggerGenerator: CatnipTriggerFunctionGenerator,
    backdropName: string
}

/**
 * Starts `event_whenbackdropswitchesto` hats. Like broadcast, the hat names
 * are compared case-insensitively (scratch upper-cases both sides in
 * runtime.startHats), so the map is keyed lower-case and the generated
 * dispatcher compares through catnip_blockutil_hstring_cmp.
 */
export class CatnipCompilerBackdropSubsystem extends CatnipCompilerSubsystem {

    private readonly _backdropTriggers: Map<string, BackdropSwitchTriggerInfo>;
    private readonly _dispatch: SpiderFunctionDefinition;

    public constructor(compiler: CatnipCompiler) {
        super(compiler);
        this._backdropTriggers = new Map();
        this._dispatch = this.spiderModule.createFunction();
    }

    private _getBackdropInfo(name: string) {
        name = name.toLowerCase();
        let backdropInfo = this._backdropTriggers.get(name);

        if (backdropInfo === undefined) {
            backdropInfo = {
                backdropName: name,
                // scratch's when-backdrop-switches-to is a restart-on-fire hat
                // (restartExistingThreads: true in the VM's hat definition).
                triggerGenerator: new CatnipTriggerFunctionGenerator(this.compiler, true, CATNIP_THREAD_START_RESTART)
            };
            this._backdropTriggers.set(name, backdropInfo);
        }

        return backdropInfo;
    }

    public registerBackdropSwitchTrigger(trigger: CatnipIrScriptBackdropSwitchTrigger) {
        this._getBackdropInfo(trigger.inputs.name).triggerGenerator.addTrigger(trigger);
    }

    public hasTriggers(): boolean {
        return this._backdropTriggers.size > 0;
    }

    public getDispatchFunction(): SpiderFunction {
        return this._dispatch;
    }

    public addEvents(): void {
        const backdropName = this._dispatch.addParameter(SpiderNumberType.i32);
        const threadListPtrVarRef = this._dispatch.addParameter(SpiderNumberType.i32);

        // A stage without backdrops has no name to match against.
        this._dispatch.body.emit(SpiderOpcodes.local_get, backdropName);
        this._dispatch.body.emit(SpiderOpcodes.i32_eqz);
        this._dispatch.body.emitIf((trueBody) => {
            trueBody.emit(SpiderOpcodes.return);
        });

        for (const backdropInfo of this._backdropTriggers.values()) {
            const eventFunc = backdropInfo.triggerGenerator.createEventFunction();

            this._dispatch.body.emit(SpiderOpcodes.local_get, backdropName);
            this._dispatch.body.emitConstant(
                SpiderNumberType.i32,
                this.compiler.runtimeModule.createCanonHString(backdropInfo.backdropName)
            );
            this._dispatch.body.emit(
                SpiderOpcodes.call,
                this.compiler.getRuntimeFunction("catnip_blockutil_hstring_cmp")
            );
            this._dispatch.body.emit(SpiderOpcodes.i32_eqz);

            this._dispatch.body.emitIf((trueBody) => {
                trueBody.emit(SpiderOpcodes.local_get, threadListPtrVarRef);
                trueBody.emit(SpiderOpcodes.call, eventFunc);
                trueBody.emit(SpiderOpcodes.return);
            });
        }
    }
}
