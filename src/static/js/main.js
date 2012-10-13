$(function() {
    var WidgetDefinition = Backbone.Model.extend({
        defaults: {
            'name': 'new widget',
            'description': 'this is a new widget',
            'dimensions': 1,
            'source': '{}'
        },
        url: 'ws/widget-definition/'
    });
    var WidgetDefinitionList = Backbone.Collection.extend({
        model: WidgetDefinition,
        url: 'ws/widget-definition/'
    });

    var WidgetLibraryView = Backbone.View.extend({
        el: $('#widget-library'),
        template: _.template($('#widget-library-tpl').html()),

        events: {
            'click li a': 'loadWidgetDefinition',
        },

        render: function() {
            var view = this;
            view.collection.fetch({success: function() {
                view.$el.html(view.template({models: view.collection.toJSON()}));
            }});
            return view;
        },

        loadWidgetDefinition: function(e) {
            var id = e.target.hash.substr(1);
            var model = this.collection.get(id);

            var widget_editor = new WidgetDefinitionView({
                model: model
            });
            widget_editor.render();
        }
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
            this.model.set($target.attr('name'), $target.val());
        },

        save: function() {
            this.model.save();
        }
    });

    var widget_library = new WidgetLibraryView({
        collection: new WidgetDefinitionList()
    });
    widget_library.render();

    var widget_editor = new WidgetDefinitionView({
        model: new WidgetDefinition()
    });
    widget_editor.render();
});
