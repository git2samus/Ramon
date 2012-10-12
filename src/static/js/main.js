$(function() {
    var WidgetDefinition = Backbone.Model.extend({
        defaults: { "name": "new widget", "description": "this is a new widget", "dimensions": 1, "source": "{}" }
    });

    var WidgetDefinitionView = Backbone.View.extend({
        template: _.template($('#widget-definition-tpl').html()),
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        }
    });

    var App = new WidgetDefinitionView({
        el: $("#main"),
        model: new WidgetDefinition()
    });
    App.render();
});
