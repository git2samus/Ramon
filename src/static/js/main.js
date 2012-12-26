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

    // widget definition persistence
    var WidgetDefinition = Backbone.Model.extend({
        // idAttribute does not play well with isNew()
        // className attribute conflicts with Backbone's
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'widgetClass': 'newWidget',
            'parentClass': '',
            'source': [
                '{',
                '    loadConfig: function(cfg) { },',
                '    loadData: function(data) { },',
                '    render: function() {',
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

            view.$el.html(view.template({
                models: collection,
                currentModel: model
            }));

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
                var DynamicView = Backbone.View.extend(options);
                var widget_preview = new DynamicView({
                    el: $('#widget-preview'),
                });
                widget_preview.loadConfig(cfg);
                widget_preview.loadData(data);
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
