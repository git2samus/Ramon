function getDatasourceOptions(url, settings) {
    if (Backbone.emulateHTTP) {
        settings.type = 'POST';
        settings.headers = settings.headers || {};
        settings.headers['X-HTTP-Method-Override'] = 'OPTIONS';
    } else {
        settings.type = 'OPTIONS';
    }

    return $.ajax(url, settings);
}

function main() {
    // X-HTTP-Method-Override browser compatibility workaround
    Backbone.emulateHTTP = true;

    // base class for all widgets
    var BaseWidget = Backbone.View.extend({
        options: {
            _widget: {}
        },
        getWidgetOptions: function() {
            return this.options._widget.options || {};
        },
        setWidgetOptions: function(widgetOptions) {
            this.options._widget.options = widgetOptions;
        },
        getDatasource: function() {
            return this.options._widget.datasource || null;
        },
        setDatasource: function(url) {
            //TODO compare/validate metadata
            this.options._widget.datasource = url;
        },
        getWidgetData: function(settings) {
            var datasource = this.getDatasource();
            if (!datasource)
                throw 'datasource not configured';

            settings = settings || {};
            settings.dataType = 'json';

            return $.ajax(datasource, settings);
        },
    });

    // widget definition persistence
    var WidgetDefinition = Backbone.Model.extend({
        // idAttribute does not play well with isNew()
        // className attribute conflicts with Backbone's
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'series': 1,
            'dimensions': 1,
            'widgetClass': 'newWidget',
            'parentClass': '',
            'source': [
                '{',
                '    getData: function(settings) {',
                '        /* override this method to adapt data to your format */',
                '        var widgetOptions = this.getWidgetOptions();',
                '        return newWidget.prototype.getData.apply(this, arguments);',
                '    },',
                '    render: function() {',
                '        /* draw widget */',
                '        var widgetOptions = this.getWidgetOptions();',
                '        var widgetData    = this.getWidgetData();',
                '        this.$el.html("new widget");',
                '        return this;',
                '    },',
                '}',
            ].join('\n'),
        },
        url: function() {
            if (this.isNew())
                return 'ws/widget-definition';
            else
                return 'ws/widget-definition/' + this.id;
        },
    });
    var WidgetDefinitionList = Backbone.Collection.extend({
        model: WidgetDefinition,
        url: 'ws/widget-definition',
        asTree: function() {
            // returns collection as nested arrays based on parentClass
            var collection = this;

            var constructNodes = function(parentClass) {
                var children = collection.filter(function(model) {
                    return model.get('parentClass') == parentClass;
                });

                return _.chain(children)
                    .sortBy(function(model) {
                        return model.get('widgetClass');
                    }).map(function(model) {
                        return {
                            model: model,
                            children: constructNodes(model.get('widgetClass')),
                        };
                    }).value();
            };

            return constructNodes();
        }
    });

    // list of available widgets view
    var WidgetLibraryView = Backbone.View.extend({
        el: $('#widget-library'),
        template: _.template($('#widget-library-tpl').html()),

        render: function() {
            var view = this;
            var model = this.model;
            var collection = this.collection;

            view.$el.html(view.template({
                models: collection,
                currentModel: model
            }));
            return view;
        },
    });

    // widget editor view
    var WidgetEditorView = Backbone.View.extend({
        el: $('#widget-editor'),
        template: _.template($('#widget-editor-tpl').html()),

        events: {
            'change input':    'updateModel',
            'change textarea': 'updateModel',
            'change select':   'updateModel',
            'click input[type="button"]': 'updateDB',
        },

        render: function() {
            var view = this;
            var model = this.model;
            var collection = this.collection;

            var processNodes = function(nodes, depth) {
                // transforms nested arrays into flat array with depth
                flatNodes = [];

                for (var i=0; i<nodes.length; i++) {
                    var node = nodes[i];

                    flatNodes.push({
                        model: node.model,
                        depth: depth,
                    });

                    if (node.children.length)
                        flatNodes = flatNodes.concat(processNodes(node.children, depth+1));
                }

                return flatNodes;
            };

            // render template
            view.$el.html(view.template({
                models: collection,
                currentModel: model
            }));
            // fill-out select_widget
            $('select', view.$el).html('<option value="">BaseWidget</option>'+
                _.map(processNodes(collection.asTree(), 1), function(node) {
                    var currentModel = node.model;
                    var widgetClass = currentModel.get('widgetClass');
                    var depth = node.depth;

                    return '<option value="'+widgetClass+'" '+((widgetClass==model.get('parentClass'))? 'selected' : '')+' style="text-indent: '+depth+'em;">'+widgetClass+'</option>';
                }).join('')
            );

            var editor = ace.edit('editor');
            var session = editor.getSession();
            session.setMode('ace/mode/javascript');
            session.setUseSoftTabs(true);
            session.setUseWrapMode(false);
            session.setUseWorker(false); // disable syntax checker

            session.on('change', function(e) {
                model.set('source', editor.getValue());
                view.updatePreview();
            });
            editor.setValue(model.get('source'));
            editor.clearSelection();

            view.options.editor = editor;
            return view;
        },

        updateModel: function(e) {
            var view = this;
            var model = this.model;
            var collection = this.collection;

            var $target = $(e.target);
            if ($target.attr('name')) {
                console.log($target.attr('name'), $target.val());
                if ($target.attr('type') == 'checkbox')
                    model.set($target.attr('name'), $target.attr('checked') == 'checked');
                else
                    model.set($target.attr('name'), $target.val());
            }
        },

        updateDB: function(e) {
            var view = this;
            var model = this.model;
            var collection = this.collection;

            var $target = $(e.target);
            switch ($target.attr('value')) {
            case 'save':
                model.save(null, {
                    success: function() {
                        collection.fetch({
                            success: function() {
                                workspace.navigate(model.id.toString(), {trigger: true});
                            },
                        });
                    },
                });
                break;
            case 'delete':
                model.destroy({
                    success: function() {
                        collection.fetch({
                            success: function() {
                                workspace.navigate('', {trigger: true});
                            },
                        });
                    },
                });
                break;
            }
        },

        updatePreview: function() {
            var view = this;
            var model = this.model;
            var collection = this.collection;

            var source = model.get('source');
            var cfg = {};
            var data = {};

            try {
                var options = (new Function('return '+source+';'))();
                var DynamicView = BaseWidget.extend(options);
                var widget_preview = new DynamicView({
                    el: $('#widget-preview'),
                });
                widget_preview.setDatasource('/ds/test?series=3&dimensions=2');
                widget_preview.render();
            } catch(e) {
                $('#widget-preview').html('<pre>'+_.escape(e)+'</pre>');
            }
        },
    });


    // instances
    var widget_collection = new WidgetDefinitionList();
    var widget_library = new WidgetLibraryView({
        collection: widget_collection,
    });

    var widget_editor = new WidgetEditorView({
        collection: widget_collection,
    });


    // routes
    var Workspace = Backbone.Router.extend({
        routes: {
            '':          'loadWidget',
            ':widgetId': 'loadWidget',
        },

        loadWidget: function(widgetId) {
            if (widgetId)
                var model = widget_collection.get(widgetId); //TODO validation
            else
                var model = new WidgetDefinition();

            widget_library.model = model;
            widget_library.render();

            widget_editor.model = model;
            widget_editor.render();
        },
    });
    var workspace = new Workspace();

    // load widget data - fire route afterwards (calls render)
    widget_collection.fetch({
        success: function() {
            Backbone.history.start();
        },
    });
};
