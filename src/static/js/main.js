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
    var WidgetDefinitions = new WidgetDefinitionList();
    WidgetDefinitions.fetch();

    var WidgetDefinitionView = Backbone.View.extend({
        template: _.template($('#widget-definition-tpl').html()),

        events: {
            'click input[type="button"]': 'save'
        },

        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },

        save: function() {
            var data = {};
            $('form :input', this.$el).each(function(i, e) {
                var $e = $(e);
                if ($e.attr('name'))
                    data[$e.attr('name')] = $e.val();
            });

            this.model.save(data);
        }
    });

    var App = new WidgetDefinitionView({
        el: $('#main'),
        model: new WidgetDefinition()
    });
    App.render();
});
