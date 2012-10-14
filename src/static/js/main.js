$(function() {
    var dispatcher = _.clone(Backbone.Events);

    var WidgetDefinition = Backbone.Model.extend({
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'dimensions': 1,
            'source': '{}',
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
            'click input[type="button"][value="save"]': 'save',
            //'click input[type="button"][value="delete"]': 'delete'
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

        save: function() {
            this.model.save(null, {
                success: function() {
                    dispatcher.trigger('library:refresh');
                },
            });
        },
    });


    var widget_collection = new WidgetDefinitionList();
    var widget_library = new WidgetLibraryView({
        collection: widget_collection,
    });

    var widget_editor = new WidgetDefinitionView();


    dispatcher.on('library:refresh', function() {
        widget_collection.fetch({
            success: function() {
                widget_library.render();
            },
        });
    });


    var Workspace = Backbone.Router.extend({
        routes: {
            '':         'newWidget',
            'new':      'newWidget',
            'edit/:id': 'editWidget',
        },

        newWidget: function() {
            widget_library.options.current_id = 'new';
            widget_library.render();

            widget_editor.model = new WidgetDefinition();
            widget_editor.render();
        },

        editWidget: function(id) {
            widget_library.options.current_id = id;          //TODO validation
            widget_library.render();

            widget_editor.model = widget_collection.get(id); //TODO validation
            widget_editor.render();
        },
    });
    var workspace = new Workspace();


    // load widgets - fire route afterwards (calls render)
    widget_collection.fetch({
        success: function() {
            Backbone.history.start();
        },
    });
});
