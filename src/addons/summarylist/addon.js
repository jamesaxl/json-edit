/*global window define alert*/
(function (root, factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['module', 'jquery', 'jqueryui', 'json.edit', 'json.schema', 'nsgen',
               'json', 'dustjs'],
               function (module, $, $ui, JsonEdit, JsonSchema, NsGen, JSON, Dust) {
            // Also create a global in case some scripts
            // that are loaded still are looking for
            // a global even when an AMD loader is in use.
            return (root.JsonEdit = factory(module, $, $ui, JsonEdit,
                                            JsonSchema, NsGen, JSON, Dust));
        });
    } else {
        // Browser globals
        // TODO: send module.uri in some way
        root.JsonEdit = factory(null, root.$, root.$, root.JsonEdit,
                                root.JsonSchema, root.NsGen, root.JSON,
                                root.dust);
    }
}(this, function (module, $, $ui, JsonEdit, JsonSchema, NsGen, JSON, Dust) {
    "use strict";
    var formatHints = JsonEdit.defaults.hintedFormatters,
        collectHints = JsonEdit.defaults.hintedCollectors;

    formatHints.array = formatHints.array || {};

    formatHints.array.summarylist = function (name, type, id, opts, required, priv, util) {
        var
            modulePath = module.uri,
            moduleBasePath = modulePath.slice(0, modulePath.lastIndexOf("/") + 1),
            i,
            minItems,
            conf = opts["je:summarylist"],
            templateName = "summary" + (new Date()).getTime(),
            template = Dust.compile(conf.template, templateName),
            $cont,
            $list,
            $buttons,
            editImgPath   = moduleBasePath + "img/edit.png",
            removeImgPath = moduleBasePath + "img/remove.png",
            defaultValues = opts["default"] || [],
            addButton,
            widgetChilds;

        Dust.loadSource(template);

        if (typeof opts.minItems !== "number") {
            minItems = 1;
        } else {
            minItems = opts.minItems;
        }

        // if there are more default values than minItems then use that size to
        // initialize the items
        if (defaultValues.length > minItems) {
            minItems = defaultValues.length;
        }

        function linkButton(path, alt, onClick) {
            return {
                "a": {
                    "href": "#",
                    "$click": onClick,
                    "$childs": [
                        {
                            "img": {
                                "src": path,
                                "alt": alt,
                                "title": alt
                            }
                        }
                    ]
                }
            };
        }

        function button(label, onClick) {
            return {
                "button": {
                    "$click": onClick,
                    "$childs": label
                }
            };
        }

        function collectEditItem(schema, isEdit, onEditSucceeded) {
            var
                editor = $cont.children(".summary-item-editor"),
                result = priv.collectField(name, editor, schema),
                newData = result.data;

            if (result.result.ok) {
                onEditSucceeded(newData);
                editor.remove();
                $list.show();
                $buttons.show();
            } else {
                alert("error in item fields");
            }
        }

        function editItem(schema, isEdit, onEditOkClick, onEditCancelClick) {
            var
                editor = $.lego(priv.input(name, opts.items.type, id + "-item", schema, false, util)),
                buttons = {
                    "div": {
                        "class": "summary-edit-buttons",
                        "$childs": [
                            button("Ok", onEditOkClick),
                            button("Cancel", onEditCancelClick)
                        ]
                    }
                },
                cont = {
                    "div": {
                        "class": "summary-item-editor",
                        "$childs": [
                            editor,
                            buttons
                        ]
                    }
                };

            $list.hide();
            $buttons.hide();
            $cont.prepend($.lego(cont));
        }

        function onEditCancelClick() {
            $cont.children(".summary-item-editor").remove();
            $list.show();
            $buttons.show();
        }

        function addItem(data, schema, onItemAdded) {

            function onEditOkClick(id) {
                collectEditItem(schema, true, function (newData) {
                    var
                        dataItem = $("#" + id),
                        itemData = dataItem.data("data");

                    // attach the new data
                    // extend an empty object with the old data and then the
                    // new to preserve fields that are in the original object
                    // but not in the form
                    dataItem.data("data", $.extend(true, {}, itemData, newData));

                    // rerender the list item summary text and replace it
                    Dust.render(templateName, newData, function (err, text) {
                        dataItem.find(".summary-text").html(text);
                    });

                    util.events.array.item.edited.fire(name, newData, itemData, schema, {listItem: dataItem});
                });
            }

            function onEditClick(event, id) {
                var
                    itemData = $("#" + id).data("data"),
                    itemOpts = $.extend(true, {}, opts.items, {"default": itemData});

                editItem(itemOpts, true, function () {
                    onEditOkClick(id);
                }, onEditCancelClick);

                event.preventDefault();
            }

            function onRemoveClick(event, id) {
                var
                    dataItem = $("#" + id),
                    itemData = dataItem.data("data");

                dataItem.remove();

                util.events.array.item.removed.fire(name, itemData, schema, {listItem: dataItem});
                event.preventDefault();
            }

            Dust.render(templateName, data, function (err, text) {
                var
                    listItem,
                    id = "summary-item-" + (new Date()).getTime(),
                    summary = {
                        "span": {
                            "class": "summary-text",
                            "$childs": text
                        }
                    },
                    editButton = linkButton(editImgPath, "edit", function (event) {
                        onEditClick(event, id);
                    }),
                    removeButton = linkButton(removeImgPath, "remove", function (event) {
                        onRemoveClick(event, id);
                    }),
                    buttonChilds = [],
                    buttons = {
                        "span": {
                            "class": "summary-buttons",
                            "$childs": buttonChilds
                        }
                    },
                    tpl = {
                        "div": {
                            "id": id,
                            "@data": data,
                            "class": "summary-item",
                            "$childs": [
                                summary,
                                buttons
                            ]
                        }
                    };

                if (conf.allowEdit !== false) {
                    buttonChilds.push(editButton);
                }

                if (conf.allowRemove !== false) {
                    buttonChilds.push(removeButton);
                }

                listItem = $.lego(tpl);

                $list.append(listItem);

                if (onItemAdded) {
                    onItemAdded(listItem);
                }

                // remove the empty message if it's there
                $list.parent().find(".summary-empty-msg").remove();
            });
        }

        function onAddClick(schema) {
            function onEditOkClick() {
                collectEditItem(schema, false, function (newData) {
                    addItem(newData, schema, function (listItem) {
                        util.events.array.item.created.fire(name, newData, schema, {listItem: listItem});
                    });
                });
            }

            editItem(schema, true, onEditOkClick, onEditCancelClick);
        }

        util.events.rendered.add(function () {
            var i;

            $cont = $("#" + id);
            $list = $("#" + id + "-list");
            $buttons = $cont.children(".summary-action-buttons");

            for (i = 0; i < defaultValues.length; i += 1) {
                addItem(defaultValues[i], opts.items);
            }
        });

        widgetChilds = [{
            "div": {
                "class": "summary-list",
                "id": id + "-list",
                "$childs": []
            }
        }];

        if (conf.allowAdd !== false) {
            addButton = button("add", function () {
                onAddClick(opts.items);
            });

            widgetChilds.unshift({
                "div": {
                    "class": "summary-action-buttons",
                    "style": "display: table; width: 100%; text-align: right;",
                    "$childs": addButton
                }
            });
        }

        if (defaultValues.length === 0 && conf.noItemsMsg) {
            widgetChilds.unshift({
                "div": {
                    "class": "summary-empty-msg",
                    "style": "display: table; width: 100%; text-align: center;",
                    "$childs": conf.noItemsMsg
                }
            });
        }

        return {
            "div": {
                "id": id,
                "class": priv.genFieldClasses(name, opts, " ", required),
                "$childs": widgetChilds
            }
        };
    };

    collectHints.array = collectHints.array || {};

    collectHints.array.summarylist = function (key, field, schema, priv) {
        var
            data = field.find(".summary-list:first>.summary-item")
                .map(function (i, item) {
                    return $(item).data("data");
                }).toArray(),
            arrayResult = JsonSchema.validate(key, data, schema, false);

        return {result: arrayResult, data: data};
    };

    return JsonEdit;
}));
