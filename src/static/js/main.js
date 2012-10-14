$(function() {
    var dispatcher = _.clone(Backbone.Events);

    var WidgetDefinition = Backbone.Model.extend({
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'dimensions': 1,
            'source': '{\n' +
            '    config: function(cfg) { },\n' +
            '    loadData: function(data) { },\n' +
            '    render: function() { },\n' +
            '}',
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

    var WidgetLibraryView = Backbone.View.extend({
        el: $('#widget-library'),
        template: _.template($('#widget-library-tpl').html()),

        render: function() {
            if (typeof(this.options.current_id) == 'undefined')
                this.options.current_id = 'new';

            this.$el.html(this.template({
                models: this.collection.toJSON(),
                current_id: this.options.current_id,
            }));
            return this;
        },
    });

    var WidgetDefinitionView = Backbone.View.extend({
        el: $('#widget-editor'),
        template: _.template($('#widget-editor-tpl').html()),

        events: {
            'change input':    'updateModel',
            'change textarea': 'updateModel',
            'change textarea[name="source"]': 'updatePreview',
            'click input[type="button"]': 'updateDB',
        },

        render: function() {
            this.$el.html(this.template({model: this.model}));
            return this;
        },

        updateModel: function(e) {
            var $target = $(e.target);
            if ($target.attr('name'))
                this.model.set($target.attr('name'), $target.val());
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
                                if (model.isNew())
                                    dispatcher.trigger('loadWidget', 'new');
                                else
                                    dispatcher.trigger('loadWidget', model.id);
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
                                dispatcher.trigger('navigate', 'new');
                            },
                        });
                    },
                });
                break;
            }
        },

        updatePreview: function() {
            var source = this.model.get('source');
            var cfg = {};
            var data = {};

            try {
                var options = (new Function('return '+source+';'))();
                var DynamicView = Backbone.View.extend(options);
                var dynamic_view = new DynamicView({
                    el: $('#widget-preview'),
                });
                dynamic_view.config(cfg);
                dynamic_view.loadData(data);
                dynamic_view.render();
            } catch(e) {
                $('#widget-preview').html('<pre>'+_.escape(e)+'</pre>');
            }
        },
    });


    var widget_collection = new WidgetDefinitionList();
    var widget_library = new WidgetLibraryView({
        collection: widget_collection,
    });

    var widget_editor = new WidgetDefinitionView({
        collection: widget_collection,
    });

    dispatcher.on('loadWidget', function(id) {
        widget_library.options.current_id = id;              //TODO validation
        widget_library.render();

        if (id == 'new')
            widget_editor.model = new WidgetDefinition();
        else
            widget_editor.model = widget_collection.get(id); //TODO validation
        widget_editor.render();
        widget_editor.updatePreview();
    });


    var Workspace = Backbone.Router.extend({
        routes: {
            '':    'redirectNew',
            'new': 'newWidget',
            ':id': 'editWidget',
        },

        redirectNew: function() {
            this.navigate('new', {trigger: true});
        },

        newWidget: function() {
            dispatcher.trigger('loadWidget', 'new');
        },

        editWidget: function(id) {
            dispatcher.trigger('loadWidget', id);
        },
    });
    var workspace = new Workspace();

    dispatcher.on('navigate', function(path) {
        workspace.navigate(path, {trigger: true});
    });


    // load widgets - fire route afterwards (calls render)
    widget_collection.fetch({
        success: function() {
            Backbone.history.start();
        },
    });
});
