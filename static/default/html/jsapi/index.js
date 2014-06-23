// Make console.log not crash JS browsers that don't support it
if (!window.console) window.console = { log: $.noop, group: $.noop, groupEnd: $.noop, info: $.noop, error: $.noop };


Mailpile = {
    instance:           {},
    search_cache:       [],
    messages_cache:     [],
    messages_composing: {},
    tags_cache:         [],
    contacts_cache:     [],
    keybindings:        [
        ["normal", "/",      function() { $("#search-query").focus(); return false; }],
        ["normal", "c",      function() { Mailpile.compose(); }],
        ["normal", "g i",    function() { Mailpile.go("/in/inbox/"); }],
        ["normal", "g d",    function() { Mailpile.go("/in/drafts/"); }],
        ["normal", "g c",    function() { Mailpile.go("/contacts/"); }],
        ["normal", "g n c",  function() { Mailpile.go("/contacts/add/"); }],
        ["normal", "g t",    function() { Mailpile.go("/tag/list/"); }],
        ["normal", "g n t",  function() { Mailpile.go("/tag/add/"); }],
        ["normal", "g s",    function() { Mailpile.go("/settings/profiles/"); }],
        ["normal", "command+z ctrl+z",  function() { alert('Undo Something ') }],
        ["normal", "s a",    function() { Mailpile.bulk_action_select_all(); }],
        ["normal", "s n",    function() { Mailpile.bulk_action_select_none(); }],
        ["normal", "s i",    function() { Mailpile.bulk_action_select_invert(); }],
        ["normal", "k",      function() { Mailpile.bulk_action_selection_down(); }],
        ["normal", "j",      function() { Mailpile.bulk_action_selection_up(); }],
        ["normal", "enter",  function() { Mailpile.open_selected_thread(); }],
        ["normal", "f",      function() { Mailpile.update_search(); }],
        ["normal", ["a"], function() { Mailpile.keybinding_move_message(''); }],
        ["normal", ["d"], function() { Mailpile.keybinding_move_message('trash'); }],
        ["normal", ["r"], function() { Mailpile.bulk_action_read(); }],
        ["normal", ["m s"], function() { Mailpile.keybinding_move_message('spam'); }],
        ["normal", ["t"], function() { Mailpile.render_modal_tags(); }],
        ["normal", ["u"], function() { Mailpile.bulk_action_unread(); }],
        ["global", "esc", function() {
            $('input[type=text]').blur();
            $('textarea').blur();
        }]
    ],
    commands:         [],
    graphselected:    [],
    defaults: {
        view_size: "comfy"
    },
    api: {
        compose      : "/api/0/message/compose/",
        compose_send : "/api/0/message/update/send/",
        compose_save : "/api/0/message/update/",
        contacts     : "/api/0/search/address/",
        message      : "/api/0/message/=",
        tag          : "/api/0/tag/",
        tag_list     : "/api/0/tags/",
        tag_add      : "/api/0/tags/add/",
        tag_update   : "/api/0/settings/set/",
        search_new   : "/api/0/search/?q=in%3Anew",
        search       : "/api/0/search/",
        settings_add : "/api/0/settings/add/"
    },
    urls: {
        message_draft : "/message/draft/=",
        message_sent  : "/thread/=",
        tags          : "/tags/"
    },
    plugins: [],
    theme: {}
};

var favicon = new Favico({animation:'popFade'});


/* **[ Mailpile - JSAPI ]******************************************************

This autogenerates JS methods which fire GET & POST calls to Mailpile
API/command endpoints.

It also name-spaces and wraps any and all plugin javascript code.

**************************************************************************** */


/* **[ Mailpile - Theme Settings ]****************************************** */
{% set theme_settings = theme_settings() %}
Mailpile.theme = {{ theme_settings|json|safe }}


/* **[AJAX Wappers - for the Mailpile API]********************************** */
Mailpile.API = (function() {
    var api = { {% for command in result.api_methods %}
    {{command.url|replace("/", "_")}}: "/api/0/{{command.url}}/"{% if not loop.last %},{% endif %}

    {% endfor %}
    };

    function action(command, data, method, callback) {
        if (method != "GET" && method != "POST") {
            method = "GET";
        }
        switch (method) {
            case "GET":
                for(var k in data) {
                    if(!data[k] || data[k] == undefined) {
                        delete data[k];
                    }
                }
                var params = $.param(data);
                $.ajax({
                    url      : command + "?" + params,
                    type     : method,
                    dataType : 'json',
                    success  : callback,
                });
                break;
            case "POST":
                $.ajax({
                    url      : command,
                    type     : method,
                    data     : data,
                    dataType : 'json',
                    success  : callback,
                });
                break;
        }

        return true;
    };

    return {
        {%- for command in result.api_methods -%}
        {{command.url|replace("/", "_")}}: function(
            {%- for key in command.query_vars -%}pv_{{key|replace("@", "")}}, {% endfor -%}
            {%- for key in command.post_vars -%}pv_{{key|replace("@", "")|replace(".","_")|replace("-","_")}}, {%- endfor -%} callback) {
            return action(api.{{command.url|replace("/", "_")}}, {
                {%- for key in command.query_vars -%}
                    "{{key}}": pv_{{key|replace("@", "")}},
                {% endfor %}
                {%- for key in command.post_vars -%}
                    "{{key}}": pv_{{key|replace("@", "")}},
                {% endfor %}
            }, "{{command.method}}", callback);
        }{%- if not loop.last -%},{% endif %}

        {% endfor %}
    }
})();


/* Plugin Javascript - we do this in multiple commands instead of one big
   dict, so plugin setup code can reference other plugins. Plugins are
   expected to return a dictionary of values they want to make globally
   accessible.

   FIXME: Make sure the order is somehow sane given dependenies.
*/
{% for js_class in result.javascript_classes %}
{{ js_class.classname.capitalize() }} = {% if js_class.code %}(function(){
{{ js_class.code|safe }}})(); /* EOF:{{ js_class.classname }} */
{% else %}{};
{% endif %}
{% endfor %}