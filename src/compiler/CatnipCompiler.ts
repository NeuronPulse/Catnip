import { CatnipProject } from "../runtime/CatnipProject";
import { CatnipCompilerConfig, catnipBinaryenOptimizeLevelForSize, catnipCompilerConfigPoppulate } from "./CatnipCompilerConfig";
import { CatnipIr, CatnipIrInfo } from "./CatnipIr";
import { CatnipCompilerPass } from "./passes/CatnipCompilerPass";
import { PassVariableInlining } from "./passes/post-analysis/PassVariableInlining";
import { PassFunctionIndexAllocation } from "./passes/pre-analysis/PassFunctionIndexAllocation";
import { CatnipCompilerPassStage, CatnipCompilerStage, CatnipCompilerStageNames } from "./CatnipCompilerStage";
import { PassAnalyzeFunctionCallers } from "./passes/pre-analysis/PassAnalyzeFunctionCallers";
import { PassTransientVariablePropagation } from "./passes/pre-wasm/PassTransientVariablePropagation";
import { createModule, SpiderElementFuncIdxActive, SpiderFunction, SpiderFunctionDefinition, SpiderImportFunction, SpiderImportMemory, SpiderImportTable, SpiderModule, SpiderNumberType, SpiderReferenceType, SpiderTypeDefinition, SpiderValueType, writeModule } from "wasm-spider";
import { CatnipCompilerLogger } from "./CatnipCompilerLogger";
import { CatnipRuntimeModuleFunctionName, CatnipRuntimeModuleFunctions } from "../runtime/CatnipRuntimeModuleFunctions";
import { CatnipCompilerSubsystem, CatnipCompilerSubsystemClass } from "./CatnipCompilerSubsystem";
import { CatnipIrExternalBranch } from "./CatnipIrBranch";
import { CatnipOp } from "../ops";
import { CatnipValueFormat } from "./CatnipValueFormat";
import { CatnipValueFormatUtils } from "./CatnipValueFormatUtils";
import { CatnipWasmStructHeapString } from "../wasm-interop/CatnipWasmStructHeapString";
import { LoopPassTypeAnalysis } from "./passes/analysis/AnalysisPassTypeAnalysis";
import { CatnipEventID, CatnipEvents } from "../CatnipEvents";
import { CatnipCompilerEvent } from "./CatnipCompilerEvent";
import binaryen from "binaryen";
import UTF16 from "../utf16";
import { CatnipProjectModule, CatnipProjectModuleEvent } from "../runtime/CatnipProjectModule";
import { CatnipCompilerPassContext } from "./CatnipCompilerPassContext";

export interface CatnipIrPreAnalysis {
    isYielding: boolean;
    externalBranches: CatnipIrExternalBranch[];
}

export type catnip_compiler_callback = (...args: any[]) => void | number | string;
export type catnip_compiler_raw_callback = (...args: number[]) => void | number;

interface CallbackInfo {
    name: string;
    import: SpiderImportFunction;
    callback: catnip_compiler_raw_callback;
    argFormats: CatnipValueFormat[];
    returnFormat: CatnipValueFormat | null;
}

export class CatnipCompiler {
    public readonly project: CatnipProject;
    public get runtimeModule() { return this.project.runtimeModule; }
    public get runtimeInstance() { return this.project.runtimeInstance; }

    public readonly config: Readonly<CatnipCompilerConfig>;

    private readonly _passes: Map<CatnipCompilerPassStage, CatnipCompilerPass[]>;
    private _stage: CatnipCompilerStage | null;

    private readonly _stageTimings: [string, number][];
    private _timingLabel: string | null;
    private _timingAnchor: number;

    public get stage() { return this._stage; }

    /** Per-stage compile timings, in submission order. Only populated after createModule(). */
    public get stageTimings(): ReadonlyArray<readonly [string, number]> { return this._stageTimings; }

    public readonly spiderModule: SpiderModule;
    public readonly spiderMemory: SpiderImportMemory;
    public readonly spiderIndirectFunctionTable: SpiderImportTable;
    public readonly spiderIndirectFunctionType: SpiderTypeDefinition;
    private readonly _spiderFunctionNop: SpiderFunctionDefinition;

    private readonly _runtimeFuncs: ReadonlyMap<CatnipRuntimeModuleFunctionName, SpiderImportFunction>;
    private readonly _subsystems: Map<CatnipCompilerSubsystemClass, CatnipCompilerSubsystem>;
    private readonly _callbacks: Map<catnip_compiler_callback, CallbackInfo>;
    private readonly _events: Map<CatnipEventID, CatnipCompilerEvent>;

    private readonly _irs: CatnipIr[];

    private readonly _freeFunctionTableIndices: number[];
    private _functionTableOffset: number;
    private _functionTableIndexCount: number;

    private _exportCount: number;

    constructor(project: CatnipProject, config?: Partial<CatnipCompilerConfig>) {
        this.project = project;
        this.config = catnipCompilerConfigPoppulate(config);
        this._passes = new Map();
        this._stage = null;
        this._stageTimings = [];
        this._timingLabel = null;
        this._timingAnchor = 0;

        this.addPass(PassAnalyzeFunctionCallers);

        if (this.config.enable_optimization_variable_inlining)
            this.addPass(PassVariableInlining);

        if (this.config.enable_optimization_type_analysis)
            this.addPass(LoopPassTypeAnalysis)

        this.addPass(PassTransientVariablePropagation);
        this.addPass(PassFunctionIndexAllocation);

        this.spiderModule = createModule();
        this.spiderMemory = this.spiderModule.importMemory("env", "memory");
        this.spiderIndirectFunctionTable = this.spiderModule.importTable(
            "env", "indirect_function_table",
            SpiderReferenceType.funcref, 0
        );
        this.spiderIndirectFunctionType = this.spiderModule.createType(
            [SpiderNumberType.i32]
        );
        this._spiderFunctionNop = this.spiderModule.createFunction();

        const runtimeFuncs = new Map();
        this._runtimeFuncs = runtimeFuncs;

        let funcName: CatnipRuntimeModuleFunctionName;
        for (funcName in CatnipRuntimeModuleFunctions) {
            const func = CatnipRuntimeModuleFunctions[funcName];
            const funcType = this.spiderModule.createType(func.args, ...(func.result === undefined ? [] : [func.result]));
            runtimeFuncs.set(funcName, this.spiderModule.importFunction("catnip", funcName, funcType));
        }

        this._irs = [];

        this._freeFunctionTableIndices = [];
        this._functionTableIndexCount = 0;
        this._functionTableOffset = 1; // Starts at 1 because we never allocate function table index 0

        while (this.runtimeModule.indirectFunctionTable.get(this._functionTableOffset) !== null) {
            ++this._functionTableOffset;

            if (this._functionTableOffset == this.runtimeModule.indirectFunctionTable.length) {
                break;
            }
        }

        this._exportCount = 0;

        this._subsystems = new Map();
        this._events = new Map();

        this._callbacks = new Map();
    }

    public addPass(pass: CatnipCompilerPass) {
        CatnipCompilerLogger.assert(this._stage === null);

        const stage = pass.stage;
        let passes = this._passes.get(stage);

        if (passes === undefined) {
            passes = [];
            this._passes.set(stage, passes);
        }

        passes.push(pass);
        passes.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }

    private _stopTiming(): void {
        if (this._timingLabel === null) return;
        this._stageTimings.push([this._timingLabel, performance.now() - this._timingAnchor]);
        this._timingLabel = null;
    }

    private _startTiming(label: string): void {
        this._stopTiming();
        this._timingLabel = label;
        this._timingAnchor = performance.now();
    }

    private _transitionStage(stage: CatnipCompilerStage | null) {
        if (stage === null) this._stopTiming();
        else this._startTiming(CatnipCompilerStageNames[stage]);
        this._stage = stage;
    }

    private _reportStageTimings(): void {
        const timings = this._stageTimings;
        if (timings.length === 0) return;

        let total = 0;
        for (const [, ms] of timings) total += ms;

        const nameWidth = timings.reduce((w, [name]) => Math.max(w, name.length), 5);
        const rows = timings.map(([name, ms]) =>
            `  ${name.padEnd(nameWidth)}  ${ms.toFixed(1).padStart(8)} ms  ${((ms / total) * 100).toFixed(1).padStart(5)} %`);

        CatnipCompilerLogger.log(`stage timings:\n${rows.join("\n")}\n  ${"total".padEnd(nameWidth)}  ${total.toFixed(1).padStart(8)} ms`);
    }

    public async createModule(): Promise<CatnipProjectModule> {

        this._transitionStage(CatnipCompilerStage.IR_CREATION);

        for (const sprite of this.project.sprites) {
            for (const script of sprite.scripts) {
                this.createIR({
                    commands: script.commands,
                    scriptID: script.id,
                    spriteID: sprite.id,
                    trigger: script.trigger
                });
            }
        }

        //////

        this._transitionStage(CatnipCompilerStage.IR_PRE_ANLYSIS);

        this._preAnalyzeIRs();

        //////

        this._transitionStage(CatnipCompilerStage.IR_GEN);

        for (const scriptIR of this._irs) {
            if (!scriptIR.hasCommandIR)
                scriptIR.createCommandIR();
        }

        //////

        {
            const analysisContext = new CatnipCompilerPassContext(this, this._irs);

            const runPass = (stage: CatnipCompilerPassStage) => {
                this._transitionStage(stage);

                for (const pass of this._passes.get(stage) ?? []) {
                    pass.run(analysisContext);
                }
            }

            runPass(CatnipCompilerStage.PASS_PRE_ANALYSIS);
            runPass(CatnipCompilerStage.PASS_ANALYSIS);
            runPass(CatnipCompilerStage.PASS_POST_ANALYSIS);
            runPass(CatnipCompilerStage.PASS_PRE_WASM_GEN);
        }

        //////

        this._transitionStage(CatnipCompilerStage.IR_WASM_GEN);

        for (const scriptIR of this._irs) {

            if (this.config.dump_ir)
                console.log("" + scriptIR);

            scriptIR.createWASM();
        }

        //////

        this._transitionStage(CatnipCompilerStage.EVENT_WASM_GEN);

        for (const subsystem of this._subsystems.values()) {
            if (subsystem.addEvents)
                subsystem.addEvents();
        }

        let eventID: CatnipEventID;
        for (eventID in CatnipEvents) {
            if (this._events.has(eventID) || this.project.hasEventListeners(eventID)) {
                this._getEvent(eventID).generateFunction();
            }
        }

        //////

        this._transitionStage(CatnipCompilerStage.MODULE_CREATION);

        const functionsElement = this._createFunctionsElement();

        const largetFunctionElement = functionsElement.init.length + functionsElement.offset.getAsConstNumber();

        if (largetFunctionElement > this.runtimeModule.indirectFunctionTable.length) {
            this.runtimeModule.indirectFunctionTable.grow(largetFunctionElement - this.runtimeModule.indirectFunctionTable.length);
        }

        const callbacks: Record<string, catnip_compiler_raw_callback> = {};

        for (const callback of this._callbacks.values()) {
            callbacks[callback.name] = callback.callback;
        }

        this._startTiming("spider_write");
        let moduleSource = writeModule(this.spiderModule, { mergeTypes: false });

        const binaryenOptimizeLevel = typeof (this.config.enable_optimization_binaryen) === "number" ?
            this.config.enable_optimization_binaryen :
            (this.config.enable_optimization_binaryen ?
                catnipBinaryenOptimizeLevelForSize(moduleSource.byteLength) : null);

        if (this.config.enable_optimization_binaryen) {
            CatnipCompilerLogger.log(binaryenOptimizeLevel === null ?
                `binaryen: ${(moduleSource.byteLength / 1024).toFixed(0)}KiB module, too large to optimize, skipping` :
                `binaryen: ${(moduleSource.byteLength / 1024).toFixed(0)}KiB module, optimize level ${binaryenOptimizeLevel}`);
        }

        if (binaryenOptimizeLevel !== null || this.config.dump_binaryen) {
            // Reading, optimizing and emitting are timed apart: on a large
            // project binaryen is most of the compile, and it is worth knowing
            // which of the three is paying for it.
            this._startTiming("binaryen_read");
            const binaryenModule = binaryen.readBinary(moduleSource);

            if (binaryenOptimizeLevel !== null) {
                binaryen.setOptimizeLevel(binaryenOptimizeLevel);
                this._startTiming("binaryen_optimize");
                binaryenModule.optimize();
                this._startTiming("binaryen_emit");
                moduleSource = binaryenModule.emitBinary();
            }

            if (this.config.dump_binaryen) {
                switch (this.config.dump_binaryen) {
                    case "wat":
                        console.log(binaryenModule.emitText());
                        break;
                    case "as":
                        console.log(binaryenModule.emitAsmjs());
                        break;
                    case "stack":
                        console.log(binaryenModule.emitStackIR());
                        break;
                }
            }
        }

        const downloadURL = (data: string, fileName: string) => {
            const a = document.createElement('a')
            a.href = data
            a.download = fileName
            document.body.appendChild(a)
            a.style.display = 'none'
            a.click()
            a.remove()
        }

        if (globalThis.window && this.config.dump_wasm_blob) {
            const downloadBlob = (data: Uint8Array, fileName: string, mimeType: string) => {

                const blob = new Blob([data], {
                    type: mimeType
                })

                const url = window.URL.createObjectURL(blob)

                downloadURL(url, fileName)

                setTimeout(() => window.URL.revokeObjectURL(url), 1000)
            }
            downloadBlob(moduleSource, "catnip_output.wasm", "application/wasm");
        }

        this._startTiming("wasm_compile");
        const module = await WebAssembly.compile(moduleSource);

        this._startTiming("wasm_instantiate");
        const instance = await WebAssembly.instantiate(module, {
            env: {
                memory: this.runtimeModule.imports.env.memory,
                indirect_function_table: this.runtimeModule.indirectFunctionTable
            },
            catnip: this.runtimeModule.functions,
            catnip_callbacks: callbacks
        });

        const events: CatnipProjectModuleEvent[] = [];
        for (const eventInfo of this._events.values())
            events.push({ id: eventInfo.id, exportName: eventInfo.export.name });

        const projectModule = new CatnipProjectModule(this.project, instance, events);

        // TODO There's definitly more stuff to clean up
        this._deleteFunctionsElement(functionsElement);
        this._irs.length = 0;

        this._transitionStage(null);

        if (this.config.dump_stage_timings)
            this._reportStageTimings();

        return projectModule;
    }

    public createIR(info: CatnipIrInfo): CatnipIr {
        CatnipCompilerLogger.assert(this._stage !== null && this._stage < CatnipCompilerStage.IR_GEN);
        const ir = new CatnipIr(this, info);
        this._irs.push(ir);
        return ir;
    }

    public addEventListener(id: CatnipEventID, func: SpiderFunction) {
        CatnipCompilerLogger.assert(this._stage === null || this._stage < CatnipCompilerStage.MODULE_CREATION);

        this._getEvent(id).addListener(func);
    }

    public getEventFunction(id: CatnipEventID): SpiderFunction | null {
        if (this._events.has(id) || this.project.hasEventListeners(id))
            return this._getEvent(id).func;
        return null;
    }

    private _getEvent(id: CatnipEventID): CatnipCompilerEvent {
        let event = this._events.get(id);

        if (event === undefined) {
            event = new CatnipCompilerEvent(this, id);
            this._events.set(id, event);
        }

        return event;
    }

    private _createFunctionsElement(): SpiderElementFuncIdxActive {
        const spiderFns: SpiderFunctionDefinition[] = new Array(this._functionTableIndexCount);
        spiderFns.fill(this._spiderFunctionNop);

        for (const ir of this._irs) {
            for (const func of ir.functions) {
                if (func.hasFunctionTableIndex) {
                    CatnipCompilerLogger.assert(spiderFns[func.functionTableIndex - this._functionTableOffset] === this._spiderFunctionNop);
                    spiderFns[func.functionTableIndex - this._functionTableOffset] = func.spiderFunction;
                }
            }
        }

        return this.spiderModule.createElementFuncIdxActive(
            this.spiderIndirectFunctionTable, this._functionTableOffset, spiderFns
        );
    }

    private _deleteFunctionsElement(element: SpiderElementFuncIdxActive) {
        this.spiderModule.elements.splice(this.spiderModule.elements.indexOf(element), 1);
    }

    public getRuntimeFunction(funcName: CatnipRuntimeModuleFunctionName): SpiderImportFunction {
        const func = this._runtimeFuncs.get(funcName);
        if (func === undefined) throw new Error(`Unknown runtime function '${funcName}'.`);
        return func;
    }

    public allocateFunctionTableIndex(): number {
        CatnipCompilerLogger.assert(this._stage === null || this._stage < CatnipCompilerStage.MODULE_CREATION);

        if (this._freeFunctionTableIndices.length !== 0)
            return this._freeFunctionTableIndices.pop()!;

        return (this._functionTableIndexCount++) + this._functionTableOffset;
    }

    public freeFunctionTableIndex(idx: number) {
        CatnipCompilerLogger.assert(this._stage === null || this._stage < CatnipCompilerStage.MODULE_CREATION);

        this._freeFunctionTableIndices.push(idx);
    }

    public allocateExportName(name: string): string {
        return name + "_" + (this._exportCount++);
    }

    public getSubsystem<
        TClass extends CatnipCompilerSubsystemClass<TSubsystem>,
        TSubsystem extends CatnipCompilerSubsystem =
        TClass extends CatnipCompilerSubsystemClass<infer I> ? I : never
    >(subsystemClass: TClass): TSubsystem {
        CatnipCompilerLogger.assert(this._stage === null || this._stage < CatnipCompilerStage.EVENT_WASM_GEN);

        const mapSubsystem = this._subsystems.get(subsystemClass);

        if (mapSubsystem !== undefined)
            return mapSubsystem as TSubsystem;

        const newSubsystem = new subsystemClass(this);
        this._subsystems.set(subsystemClass, newSubsystem);

        return newSubsystem;
    }

    private _preAnalyzeIRs() {
        function analyzeOp(ir: CatnipIr, analysis: CatnipIrPreAnalysis, op: CatnipOp) {
            for (const inputOrSubstack of op.type.getInputsAndSubstacks(ir, op.inputs)) {
                if (Array.isArray(inputOrSubstack)) {
                    for (const command of inputOrSubstack)
                        analyzeOp(ir, analysis, command);
                } else {
                    analyzeOp(ir, analysis, inputOrSubstack);
                }
            }

            op.type.preAnalyze(ir, op.inputs);

            analysis.externalBranches.push(...op.type.getExternalBranches(ir, op.inputs));
            analysis.isYielding ||= op.type.isYielding(ir, op.inputs);
        }

        const analyses: Map<CatnipIr, CatnipIrPreAnalysis> = new Map();

        for (const ir of this._irs) {
            const analysis: CatnipIrPreAnalysis = {
                isYielding: false,
                externalBranches: []
            }

            analyses.set(ir, analysis);
            ir.setPreAnalysis(analysis);

            for (const command of ir.commands) {
                analyzeOp(ir, analysis, command);
            }
        }

        let modified = true;

        while (modified) {
            modified = false;

            for (const [ir, analysis] of analyses) {
                if (analysis.isYielding) continue;

                for (const externalBranch of analysis.externalBranches) {
                    if (externalBranch.isYielding()) {
                        analysis.isYielding = true;
                        modified = true;
                        break;
                    }
                }
            }
        }
    }

    public createRawCallback(
        name: string,
        callback: catnip_compiler_raw_callback,
        argFormats: CatnipValueFormat[],
        returnFormat: CatnipValueFormat | null,
    ): SpiderImportFunction {
        CatnipCompilerLogger.assert(this._stage === null || this._stage < CatnipCompilerStage.MODULE_CREATION);

        let callbackInfo = this._callbacks.get(callback);

        if (callbackInfo !== undefined) return callbackInfo.import;

        const parameterValueTypes: SpiderValueType[] = [];
        const returnValueType: SpiderValueType[] = [];

        for (const argFormat of argFormats)
            parameterValueTypes.push(CatnipValueFormatUtils.getFormatSpiderType(argFormat));

        if (returnFormat !== null)
            returnValueType.push(CatnipValueFormatUtils.getFormatSpiderType(returnFormat));

        callbackInfo = {
            name,
            callback,
            import: this.spiderModule.importFunction(
                "catnip_callbacks",
                name,
                this.spiderModule.createType(parameterValueTypes, ...returnValueType)
            ),
            argFormats,
            returnFormat
        };

        this._callbacks.set(callback, callbackInfo);
        return callbackInfo.import;
    }

    public createCallback(
        name: string,
        callback: catnip_compiler_callback,
        argFormats: CatnipValueFormat[],
        returnFormat: CatnipValueFormat | null,
    ): SpiderImportFunction {
        return this.createRawCallback(
            name,
            (...args: number[]) => {

                if (args.length !== argFormats.length)
                    throw new Error("Wrong callback arg types.");

                const convertedArgs: (number | string)[] = [];

                for (let i = 0; i < args.length; i++) {
                    const argFormat = argFormats[i];
                    const argValue = args[i];

                    if (CatnipValueFormatUtils.isAlways(argFormat, CatnipValueFormat.I32_HSTRING)) {
                        const bytes = argValue + CatnipWasmStructHeapString.size;
                        const byteLength = CatnipWasmStructHeapString.getMember(argValue, this.runtimeModule.memory, "bytelen") - CatnipWasmStructHeapString.size;

                        const stringValue = UTF16.decode(this.runtimeModule.memory.buffer.slice(bytes, bytes + byteLength));

                        convertedArgs.push(stringValue);
                    } else {
                        convertedArgs.push(argValue);
                    }
                }

                const returnValue = callback(...convertedArgs);

                if (returnFormat !== null) {
                    if (returnValue === undefined)
                        throw new Error("Callback must return a value.");

                    if (CatnipValueFormatUtils.isAlways(returnFormat, CatnipValueFormat.I32_HSTRING)) {
                        return this.runtimeModule.createCanonHString("" + returnValue);
                    } else {
                        if (typeof returnValue !== "number")
                            throw new Error("Expected callback return of type number.");
                        return returnValue;
                    }
                }
            },
            argFormats,
            returnFormat
        );
    }
}