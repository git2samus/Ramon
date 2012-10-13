$(function() {
    var WidgetDefinition = Backbone.Model.extend({
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'dimensions': 1,
            'source': '{}',
        },
        url: 'ws/widget-definition/',
    });
    var WidgetDefinitionList = Backbone.Collection.extend({
        model: WidgetDefinition,
        url: 'ws/widget-definition/',
    });

    var WidgetLibraryView = Backbone.View.extend({
        el: $('#widget-library'),
        template: _.template($('#widget-library-tpl').html()),

        render: function() {
            this.$el.html(this.template({models: this.collection.toJSON()}));
            return this;
        },
    });

    var WidgetDefinitionView = Backbone.View.extend({
        el: $('#widget-editor'),
        template: _.template($('#widget-editor-tpl').html()),

        events: {
            'change input': 'updateModel',
            'click input[type="button"][value="save"]': 'save'
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
            var view = this;
            var library = this.options.library;
            if (view.model.isNew())
                library.collection.add(view.model);

            view.model.save(null, {
                success: function() {
                    library.render();
                }
            });
        },
    });


    var widget_collection = new WidgetDefinitionList();
    var widget_library = new WidgetLibraryView({
        collection: widget_collection
    });

    var widget_editor = new WidgetDefinitionView();


    var Workspace = Backbone.Router.extend({
        routes: {
            '':         'newWidget',
            'edit/:id': 'editWidget',
        },

        newWidget: function() {
            widget_collection.fetch({
                success: function() {
                    widget_library.render();

                    widget_editor.model = new WidgetDefinition();
                    widget_editor.render();
                },
            });
        },

        editWidget: function(id) {
            widget_collection.fetch({
                success: function() {
                    widget_library.render();

                    widget_editor.model = widget_collection.get(id); //TODO validation
                    widget_editor.render();
                },
            });
        },
    });

    var workspace = new Workspace();
    Backbone.history.start();
});
