/**
 * This should take care of flagging the LAST selected item in those cases:
 *
 *  - jQ UI $.selectable's multi selection using drag area (integrated using jQ UI $.selectable's Events)
 *
 *  - Single click selection (integrated by assumption that the .get_currently_selected will also try to cover this
 *  case when there is only one .ui-selected...this is how no other code had to be changed :))
 *
 *  - Left/right/up/down keys (integrated by using the .set_currently_selected and .get_currently_selected public
 *  methods)
 *
 * @param $selectable
 * @param resume {boolean}
 * @returns {*}
 * @constructor
 */
var SelectionManager = function($selectable, resume) {
    var self = this;

    $selectable.unbind('selectableselecting');
    $selectable.unbind('selectableselected');
    $selectable.unbind('selectableunselecting');
    $selectable.unbind('selectableunselected');

    /**
     * Store all selected items in an _ordered_ array.
     *
     * @type {Array}
     */
    this.selected_list = [];


    this.last_selected = null;

    /**
     * Helper func to clear old reset state from other icons.
     */
    this.clear_last_selected = function() {
        if (this.last_selected) {
            $('.currently-selected', $selectable).removeClass('currently-selected');

            this.last_selected = null;
        }
    };

    this.clear_selection = function() {
        this.selected_list.forEach(function(nodeId) {
            $('#' + nodeId, $selectable)
                .removeClass('ui-selected');
        });

        this.selected_list = $.selected = [];

        this.clear_last_selected();
    };

    if (!resume) {
        this.clear_selection(); // remove ANY old .currently-selected values.
    }
    else {
        this.clear_last_selected();
    }

    /**
     * The idea of this method is to _validate_ and return the .currently-selected element.
     *
     * @param first_or_last string ("first" or "last") by default will return the first selected element if there is
     * not .currently-selected
     *
     * @returns {String} node id
     */
    this.get_currently_selected = function(first_or_last) {
        // TODO: Major refactoring is required here.
        if (this.last_selected) {
            return this.last_selected;
        }
        else if ((first_or_last === "first" || !first_or_last) && M.v.length > 0) {
            return SelectionManager.dynamicNodeIdRetriever(M.v[0]);
        }
        else if (first_or_last === "last" &&  M.v.length > 0) {
            return SelectionManager.dynamicNodeIdRetriever(M.v[M.v.length - 1]);
        }
        else {
            return false;
        }
    };

    /**
     * Used from the shortcut keys code.
     *
     * @param nodeId
     */
    this.set_currently_selected = function(nodeId, scrollTo) {
        self.clear_last_selected();
        quickFinder.disable_if_active();


        if (this.selected_list.indexOf(nodeId) === -1) {
            this.add_to_selection(nodeId, scrollTo);
            return;
        }

        if ($.isArray(nodeId)) {
            this.last_selected = nodeId[nodeId.length-1];
        }
        else {
            this.last_selected = nodeId;
        }

        if (scrollTo && !$.isArray(nodeId)) {
            var $element = $('#' + this.last_selected, $selectable);
            $element.addClass("currently-selected");
            // Do .scrollIntoView if the parent or parent -> parent DOM Element is a JSP.
            {
                var $jsp = $element.getParentJScrollPane();
                if ($jsp) {
                    $jsp.scrollToElement($element);
                }
                else {
                    if (M.megaRender && M.megaRender.megaList) {
                        M.megaRender.megaList.scrollToItem(this.last_selected);
                    }
                }
            }
        }
    };

    this.add_to_selection = function(nodeId, scrollTo) {
        if (this.selected_list.indexOf(nodeId) === -1) {
            this.selected_list.push(nodeId);
            $('#' + nodeId, $selectable).addClass('ui-selected');
            this.set_currently_selected(nodeId, scrollTo);
        }
        $.selected = this.selected_list;
    };

    this.remove_from_selection = function(nodeId) {
        var foundIndex = this.selected_list.indexOf(nodeId);

        if (foundIndex > -1) {
            this.selected_list.splice(foundIndex, 1);
            $('#' + nodeId, $selectable).removeClass('ui-selected');
            if (this.last_selected === nodeId) {
                $('#' + nodeId, $selectable).removeClass('currently-selected');
                this.last_selected = null;
            }
            $.selected = this.selected_list;
        }
    };

    /**
     * Simple helper func, for selecting all elements in the current view.
     */
    this.select_all = function() {
        var self = this;

        self.clear_selection();

        M.v.forEach(function(v) {
            self.add_to_selection(SelectionManager.dynamicNodeIdRetriever(v), false);
        });
    };

    this.select_next = function(shiftKey, scrollTo) {
        this._select_pointer(1, shiftKey, scrollTo);
    };

    this.select_prev = function(shiftKey, scrollTo) {
        this._select_pointer(-1, shiftKey, scrollTo);
    };

    this._select_pointer = function(ptr, shiftKey, scrollTo) {
        var currentViewIds = [];
        M.v.forEach(function(v) {
            currentViewIds.push(SelectionManager.dynamicNodeIdRetriever(v));
        });

        var current = this.get_currently_selected("first");

        var nextIndex = currentViewIds.indexOf(current);
        if (ptr === -1) {
            if (nextIndex > -1 && nextIndex - 1 >= 0) {
                var nextId = currentViewIds[nextIndex - 1];

                // clear old selection if no shiftKey
                if (!shiftKey) {
                    this.clear_selection();
                    this.set_currently_selected(nextId, scrollTo);
                }
                else {
                    this.add_to_selection(nextId, scrollTo);
                }
            }
        }
        else if (ptr === 1) {
            if (nextIndex + 1 < currentViewIds.length) {
                var nextId = currentViewIds[nextIndex + 1];

                // clear old selection if no shiftKey
                if (!shiftKey) {
                    this.clear_selection();
                    this.set_currently_selected(nextId, scrollTo);
                }
                else {
                    this.add_to_selection(nextId, scrollTo);
                }
            }
        }
    };

    this._select_ptr_grid = function(ptr, shiftKey, scrollTo) {
        var currentViewIds = [];
        M.v.forEach(function(v) {
            currentViewIds.push(SelectionManager.dynamicNodeIdRetriever(v));
        });

        var items_per_row = Math.floor(
            $('.file-block').parent().outerWidth() / $('.file-block:first').outerWidth(true)
        );

        var current = this.get_currently_selected("first");
        var current_idx = currentViewIds.indexOf(current);


        var target_element_num;

        if (ptr === -1) { // up
            // handle the case when the users presses ^ and the current row is the first row
            target_element_num = current_idx - items_per_row;
        } else if (ptr === 1) { // down
            // handle the case when the users presses DOWN and the current row is the last row
            target_element_num = current_idx + items_per_row;
        }
        else {
            assert('selectionManager._select_ptr_grid received invalid pointer: ' + ptr);
        }

        // calc the index of the target element
        if (target_element_num >= currentViewIds.length) {
            if (ptr === -1) { // up
                target_element_num = 0;
            }
            else {
                // down
                target_element_num = currentViewIds.length - 1;
            }
        }
        if (target_element_num >= 0) {
            if (shiftKey) {
                var node = document.getElementById(currentViewIds[target_element_num]);
                if (node) {
                    node.classList.add('ui-selected');
                }
                this.add_to_selection(currentViewIds[target_element_num], scrollTo);
            }
            else {
                this.clear_selection();
                $("#" + currentViewIds[target_element_num]).addClass('ui-selected');
                this.set_currently_selected(currentViewIds[target_element_num], scrollTo);
            }

        }
        else {
            // do nothing.
        }
    };

    this.select_grid_up = function(shiftKey, scrollTo) {
        this._select_ptr_grid(-1, shiftKey, scrollTo);
    };

    this.select_grid_down = function(shiftKey, scrollTo) {
        this._select_ptr_grid(1, shiftKey, scrollTo);
    };


    this.shift_select_to = function(lastId, scrollTo) {
        assert(lastId, 'missing lastId for selectionManager.shift_select_to');

        var currentViewIds = [];
        M.v.forEach(function(v) {
            currentViewIds.push(SelectionManager.dynamicNodeIdRetriever(v));
        });

        var current = this.get_currently_selected("first");
        var current_idx = currentViewIds.indexOf(current);
        var last_idx = currentViewIds.indexOf(lastId);
        if (current_idx !== -1 && last_idx !== -1) {
            if (last_idx > current_idx) {
                // direction - down
                for (var i = Math.min(current_idx + 1, currentViewIds.length-1); i <= last_idx; i++) {
                    this.add_to_selection(currentViewIds[i], scrollTo);
                }
            }
            else {
                // direction - up
                for (var i = Math.max(0, current_idx - 1); i >= last_idx; i--) {
                    this.add_to_selection(currentViewIds[i], scrollTo);
                }
            }
        }
    };

    /**
     * Use this to get ALL (multiple!) selected items in the currently visible view/grid.
     */
    this.get_selected = function() {
        return this.selected_list;
    };

    /**
     * Push the last selected item to the end of the selected_list array.
     */
    $selectable.bind('selectableselecting', function(e, data) {
        var $selected = $(data.selecting);
        var id = $selected.attr('id');
        if (id) {
            self.add_to_selection(id);
        }
    });

    /**
     * Remove any unselected element from the selected_list array.
     */
    $selectable.bind('selectableunselecting', function(e, data) {
        var $unselected = $(data.unselecting);
        var unselectedId = $unselected.data('id');
        if (unselectedId) {
            self.remove_from_selection(unselectedId);
        }
    });

    /**
     * After the user finished selecting the icons, flag the last selected one as .currently-selecting
     */
    $selectable.bind('selectablestop', function(e, data) {
        // dont do nothing
    });

    if (localStorage.selectionManagerDebug) {
        var self = this;
        Object.keys(self).forEach(function(k) {
            if (typeof(self[k]) === 'function') {
                var old = self[k];
                self[k] = function () {
                    console.error(k, arguments);
                    return old.apply(this, arguments);
                };
            }
        });
        this.$selectable = $selectable;
    }

    return this;
};

/**
 * Helper function that would retrieve the DOM Node ID from `n` and convert it to DOM node ID
 *
 * @param n
 */
SelectionManager.dynamicNodeIdRetriever = function(n) {
    if ((M.currentdirid === "ipc" || M.currentdirid === "opc") && n.p) {
        return M.currentdirid + "_" + n.p;
    }
    else {
        return n.h;
    }
};

var selectionManager;
