import { registerSB3InputBlock } from "../../sb3_ops";
import { op_const } from "../core/const";
import { op_get_backdrop_number_name, op_next_backdrop, op_switch_backdrop } from "./backdrop";
import { op_change_effect, op_clear_effects, op_set_effect } from "./effects";
import { op_get_costume } from "./get_costume";
import { op_change_layer, op_goto_frontback } from "./layers";
import { op_next_costume } from "./next_costume";
import "./say";
import { op_change_size, op_get_size, op_set_size, op_stretch_noop } from "./size";
import { op_hide, op_hide_all_sprites, op_show } from "./show_hide";
import { op_switch_to_costume } from "./switch_to_costume";

registerSB3InputBlock("looks_costume", (ctx, block) =>
    op_const.create({
        value: block.fields.COSTUME[0]
    })
);

// The backdrop dropdown resolves to a constant name, like the costume one.
registerSB3InputBlock("looks_backdrops", (ctx, block) =>
    op_const.create({
        value: block.fields.BACKDROP[0]
    })
);

export default {
    looks_switch_to_costume: op_switch_to_costume,
    looks_get_costume: op_get_costume,
    looks_next_costume: op_next_costume,
    looks_switch_backdrop: op_switch_backdrop,
    looks_next_backdrop: op_next_backdrop,
    looks_get_backdrop_number_name: op_get_backdrop_number_name,
    looks_show: op_show,
    looks_hide: op_hide,
    looks_hide_all_sprites: op_hide_all_sprites,
    looks_set_size: op_set_size,
    looks_change_size: op_change_size,
    looks_get_size: op_get_size,
    looks_stretch_noop: op_stretch_noop,
    looks_set_effect: op_set_effect,
    looks_change_effect: op_change_effect,
    looks_clear_effects: op_clear_effects,
    looks_goto_frontback: op_goto_frontback,
    looks_change_layer: op_change_layer,
};
