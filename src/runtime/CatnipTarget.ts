import { WasmStructWrapper } from "../wasm-interop/wasm-types";
import { CatnipSprite } from "./CatnipSprite";
import { CatnipVariableID } from "./CatnipVariable";
import { CatnipWasmStructTarget, CATNIP_TARGET_FLAG_IS_STAGE, CATNIP_TARGET_FLAG_IS_VISIBLE, CATNIP_TARGET_FLAG_IS_DRAGGABLE, CATNIP_ROTATION_STYLE_ALL_AROUND, CATNIP_ROTATION_STYLE_LEFT_RIGHT, CATNIP_ROTATION_STYLE_NONE } from '../wasm-interop/CatnipWasmStructTarget';
import { CatnipListID } from "./CatnipList";
import { CatnipWasmStructValue, CatnipWasmUnionValue } from "../wasm-interop/CatnipWasmStructValue";
import { Cast } from "../compiler/cast";

export interface CatnipTargetDesc {
    variables: CatnipTargetVariableDesc[];
    lists: CatnipTargetListDesc[];

    isStage: boolean;
    visible: boolean;

    x_position: number;
    y_position: number;
    direction: number;
    size: number;
    currentCostume: number;

    /** How the sprite rotates; the stage is always "all around". */
    rotationStyle: "all around" | "left-right" | "don't rotate";
    /** Scratch's target.draggable — whether the sprite can be dragged. */
    draggable: boolean;
    /** Scratch's saved z-order: higher layers are drawn in front. */
    layerOrder: number;
}

export interface CatnipTargetVariableDesc {
    id: CatnipVariableID;
    value: number | string;
}

export interface CatnipTargetListDesc {
    id: CatnipListID;
    /**
     * The list's initial contents, exactly as they were deserialized: the
     * values are only interpreted here, so that a list with millions of entries
     * does not have to be copied first.
     */
    value: readonly (number | string | boolean)[];
}

export class CatnipTarget {

    public readonly sprite: CatnipSprite;
    public get project() { return this.sprite.project; }
    public get runtime() { return this.project.runtimeModule; }

    public readonly structWrapper: WasmStructWrapper<typeof CatnipWasmStructTarget>;

    private _variables: Map<CatnipVariableID, number | string>;

    private _currentCostume: number;

    public readonly rotationStyle: "all around" | "left-right" | "don't rotate";
    public readonly layerOrder: number;

    /** @internal */
    constructor(sprite: CatnipSprite, desc: CatnipTargetDesc) {
        this.sprite = sprite;

        this.structWrapper = CatnipWasmStructTarget.getWrapper(
            this.runtime.functions.catnip_target_new(
                this.project.runtimeInstance.ptr,
                this.sprite.structWrapper.ptr
            ), () => this.runtime.memory);

        this._variables = new Map();
        this._currentCostume = desc.currentCostume;
        this.rotationStyle = desc.rotationStyle;
        this.layerOrder = desc.layerOrder;

        const variableTable = this.structWrapper
            .getMemberWrapper("variable_table")
            .getInnerWrapper();

        for (let { id, value } of desc.variables) {
            const variable = this.sprite.getVariable(id);
            if (variable === undefined) continue; // TODO Warn?

            if (typeof value === "string") {
                const valueNumber = Cast.toNumber(value);

                if (Cast.toString(valueNumber) === value)
                    value = valueNumber;
            }

            this.runtime.setValue(
                variableTable.getElementWrapper(variable.index),
                value
            );

            this._variables.set(id, value);
        }

        const listTable = this.structWrapper
            .getMemberWrapper("list_table")
            .getInnerWrapper();

        for (const { id, value } of desc.lists) {
            const list = this.sprite.getList(id);
            if (list === undefined) continue; // TODO Warn?

            const listWrapper = listTable.getElementWrapper(list.index);
            const listDataPtr = this.runtime.allocateMemory(CatnipWasmUnionValue.size * value.length);

            listWrapper.setMember("length", value.length);
            listWrapper.setMember("capacity", value.length);
            listWrapper.setMember("data", listDataPtr);

            // Values that Scratch treats as numbers are stored straight into the
            // f64 arm of the value union. Going through a fresh union wrapper per
            // entry instead costs seconds on a list with millions of entries, and
            // a list's numeric entries are exactly the ones there are millions of.
            const bufferProvider = listWrapper.bufferProvider;
            let numbers = new Float64Array(bufferProvider().buffer, listDataPtr, value.length);

            for (let itemIndex = 0; itemIndex < value.length; itemIndex++) {
                let listItem = value[itemIndex];

                if (typeof listItem === "boolean") listItem = "" + listItem;

                if (typeof listItem === "string") {
                    const listItemNumber = Cast.toNumber(listItem);

                    if (Cast.toString(listItemNumber) === listItem) {
                        listItem = listItemNumber;
                    } else {
                        // The entry really is a string, so it has to be interned.
                        // Interning allocates in the runtime's memory, which can
                        // grow — and so detach the view above — while we do it.
                        this.runtime.setValue(
                            CatnipWasmUnionValue.getWrapper(listDataPtr + itemIndex * CatnipWasmUnionValue.size, bufferProvider),
                            listItem
                        );

                        if (numbers.buffer !== bufferProvider().buffer)
                            numbers = new Float64Array(bufferProvider().buffer, listDataPtr, value.length);

                        continue;
                    }
                }

                numbers[itemIndex] = listItem;
            }
        }

        this.structWrapper.setMember("costume", this._currentCostume);

        this.structWrapper.setMember("position_x", desc.x_position);
        this.structWrapper.setMember("position_y", desc.y_position);
        this.structWrapper.setMember("direction", desc.direction);
        this.structWrapper.setMember("size", desc.size);

        const rotationStyles: Record<typeof desc.rotationStyle, number> = {
            "all around": CATNIP_ROTATION_STYLE_ALL_AROUND,
            "left-right": CATNIP_ROTATION_STYLE_LEFT_RIGHT,
            "don't rotate": CATNIP_ROTATION_STYLE_NONE,
        };
        this.structWrapper.setMember("rotation_style", rotationStyles[desc.rotationStyle]);

        // Scratch's saved z-order: sprites rank 1..n back to front, the
        // stage's rank 0 stays untouched by every layer op.
        this.structWrapper.setMember("layer_rank", desc.layerOrder);
        this.structWrapper.setMember("layer_gen", 0);

        let flags = desc.isStage ? CATNIP_TARGET_FLAG_IS_STAGE : 0;
        if (desc.visible) flags |= CATNIP_TARGET_FLAG_IS_VISIBLE;
        // scratch RenderedTarget.update reads draggable from the project data.
        if (desc.draggable) flags |= CATNIP_TARGET_FLAG_IS_DRAGGABLE;

        this.structWrapper.setMember("flags", flags);
    }

    public getVariableValue(variableID: CatnipVariableID): string | number {
        if (!this._variables.has(variableID))
            throw new Error(`Target does not have variable with id '${variableID}'.`);
        return this._variables.get(variableID)!;
    }
}