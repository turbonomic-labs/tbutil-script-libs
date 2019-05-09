/*global exports*/
/*jslint plusplus: true*/

/**
 * A class used to represent a Turbonomic Action and provide some useful helper
 * functionality. At the moment, it's limited, and only supports checking for
 * RI Buy decisions on a VM move action.
 * @class
 */
var Action = (function () {
    "use strict";

    /**
     * For a VirtualMachine MOVE action, a boolean indicating if an RI should be
     * purchased for the target template type.
     * @ri_to_buy Action#ri_to_buy
     * @type {bool}
     */
    Action.prototype.ri_to_buy = false;

    /**
     * For a VirtualMachine MOVE action, a decimal number containing the hourly
     * reserved instance cost for the target template. Only set if Action#ri_to_buy
     * is true.
     * @cost_with_ri Action#cost_with_ri
     * @type {number}
     */
    Action.prototype.cost_with_ri = 0;

    /**
     * Initializes a new instance of Action. Can be initialized either with an
     * action returned by the tbutil client, or with any "falsy" value (null will do fine).
     * The newly constructed object will have all of the same properties as the
     * action passed in, plus Action#ri_to_buy and Action#cost_with_ri.
     *
     * @constructs Action
     *
     * @param {object=} action - An action object returned by the tbutil client.
     *
     * @example
     * var action = new Action(client.getActionByUuid('uuid'));
     */
    function Action(action) {
        // TODO: If this already *is* an action, no need to re-do this. Check
        // for something like if action.prototype === Action.prototype?
        if (action) {
            this.ri_to_buy = false;
            this.cost_with_ri = 0;
            var gAction = this,
                sidx = 0,
                fidx = 0;
            Object.keys(action).forEach(function (key) {
                gAction[key] = action[key];
            });

            if (action.hasOwnProperty("target") && action.target.hasOwnProperty("className") && action.target.className.toLowerCase() === "virtualmachine") {
                if (!action.hasOwnProperty('reservedInstance')) { // 6.2 RI logic
                    if (action.hasOwnProperty("stats")) {
                        for (sidx = 0; sidx < action.stats.length; sidx++) {
                            if (action.stats[sidx].name === "costPrice") {
                                for (fidx = 0; fidx < action.stats[sidx].filters.length; fidx++) {
                                    if (action.stats[sidx].filters[fidx].type === "savingsType" && action.stats[sidx].filters[fidx].value === "superSavings") {
                                        this.ri_to_buy = true;
                                        // TODO: This calculates the same as the dashboard, but it is consistently wrong (higher)
                                        // than the actual 3yr RI. -- Fixed in 6.3.x?
                                        this.cost_with_ri = action.stats[sidx].value * -1;
                                    }
                                }
                            }
                        }
                    }
                } else if (action.reservedInstance.toBuy) { // 6.3 RI logic
                    this.ri_to_buy = true;
                    this.cost_with_ri = action.reservedInstance.effectiveHourlyCost;
                }
            }
        }
    }

    return Action;
}());

/**
 * A class representing an array of {@link Action}s. Mostly adds filtering
 * capabilities.
 *
 * @class
 * @implements {Array} *
 */
var ActionList = (function () {
    "use strict";

    ActionList.prototype = Object.create(Array.prototype);

    /**
     * Initializes a new ActionList. Can be initialized either with an array of
     * actions returned by the tbutil client, or with any "falsy" value (null will do fine).
     *
     * @constructs ActionList
     *
     * @param {object[]} [actions] - An array of actions object returned by the tbutil client.
     *
     * @example
     * var actions = new ActionList(client.getCurrentActionsByMarketUuid('Market', {}));
     */
    function ActionList(actions) {
        var i = 0;
        if (actions && actions.hasOwnProperty("length")) {
            for (i = 0; i < actions.length; i++) {
                this.push(new Action(actions[i]));
            }
        }
    }

    /**
     * Filters this ActionList to only actions for the specified entity type.
     *
     * @name ActionList#ByEntityType
     * @function
     * @param {string} entity_type - The name of the desired entity type. Case insensitive. Example "VirtualMachine"
     * @returns ActionList
     */
    ActionList.prototype.ByEntityType = function (entity_type) {
        var i = 0,
            return_list = new ActionList({});
        for (i = 0; i < this.length; i++) {
            if (
                this[i].hasOwnProperty("target") &&
                    this[i].target.hasOwnProperty("className") &&
                    this[i].target.className.toLowerCase() === entity_type.toLowerCase()
            ) {
                return_list.push(this[i]);
            }
        }
        return return_list;
    };


    /**
     * Filters this ActionList to only actions of the specified type.
     *
     * @name ActionList#ByActionType
     * @function
     * @param {string} action_type - The type of the desired actions. Case insensitive. Example "MOVE"
     * @returns ActionList
     */
    ActionList.prototype.ByActionType = function (action_type) {
        var i = 0,
            return_list = new ActionList({});
        for (i = 0; i < this.length; i++) {
            if (
                this[i].hasOwnProperty("actionType") &&
                    this[i].actionType.toLowerCase() === action_type.toLowerCase()
            ) {
                return_list.push(this[i]);
            }
        }
        return return_list;
    };

    return ActionList;
}());
