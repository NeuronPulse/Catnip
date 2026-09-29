import { op_all_at_once } from "./all_at_once";
import { op_create_clone_of } from "./create_clone_of";
import { op_delete_this_clone } from "./delete_this_clone";
import { op_for_each } from "./for_each";
import { op_get_counter, op_incr_counter, op_clear_counter } from "./counter";
import { op_forever } from "./forever";
import { op_if_else } from "./if_else";
import { op_repeat } from './repeat';
import { op_repeat_until } from "./repeat_until";
import { op_stop } from "./stop";
import { op_wait } from "./wait";
import { op_wait_until } from "./wait_until";
import { op_while } from "./while";
import "./start_as_clone";

export default {
    control_if_else: op_if_else,
    control_forever: op_forever,
    control_repeat: op_repeat,
    control_repeat_until: op_repeat_until,
    control_while: op_while,
    control_for_each: op_for_each,
    control_stop: op_stop,
    control_wait: op_wait,
    control_wait_until: op_wait_until,
    control_all_at_once: op_all_at_once,
    control_get_counter: op_get_counter,
    control_incr_counter: op_incr_counter,
    control_clear_counter: op_clear_counter,
    control_create_clone_of: op_create_clone_of,
    control_delete_this_clone: op_delete_this_clone,
}