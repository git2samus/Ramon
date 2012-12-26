#!/usr/bin/env python
import os, sqlite3
from contextlib import closing
from flask import Flask, render_template, g, request, json

# middleware to add support for X-HTTP-Method-Override headers
class HTTPMethodOverrideMiddleware(object):
    allowed_methods = frozenset([
        'GET',
        'HEAD',
        'POST',
        'DELETE',
        'PUT',
        'PATCH',
        'OPTIONS'
    ])
    bodyless_methods = frozenset(['GET', 'HEAD', 'OPTIONS', 'DELETE'])

    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        method = environ.get('HTTP_X_HTTP_METHOD_OVERRIDE', '').upper()
        if method in self.allowed_methods:
            method = method.encode('ascii', 'replace')
            environ['REQUEST_METHOD'] = method
        if method in self.bodyless_methods:
            environ['CONTENT_LENGTH'] = '0'
        return self.app(environ, start_response)

# WSGI application
app = Flask(__name__)
app.wsgi_app = HTTPMethodOverrideMiddleware(app.wsgi_app)


# database helpers
DATABASE = 'sqlite.db'

def init_db():
    with closing(connect_db()) as db:
        with app.open_resource('schema.sql') as f:
            db.cursor().executescript(f.read())
        db.commit()

def connect_db():
    return sqlite3.connect(DATABASE)

def query_db(query, args=(), one=False):
    mapping_dict = {
        'id':           'id',
        'name':         'name',
        'description':  'description',
        'widget_class': 'widgetClass',
        'parent_class': 'parentClass',
        'source':       'source',
    }

    cur = g.db.execute(query, args)
    g.db.commit()
    rv = (dict(
        (mapping_dict[cur.description[idx][0]], value)
        for idx, value in enumerate(row)
    ) for row in cur.fetchall())

    if one:
        try:
            return rv.next()
        except StopIteration:
            return None
    else:
        return list(rv)


@app.before_request
def before_request():
    g.db = connect_db()

@app.teardown_request
def teardown_request(exception):
    if hasattr(g, 'db'):
        g.db.close()


# datasources
@app.route('/ds/browser-stats', methods=['OPTIONS'])
def browser_stats():
    """
    RDBMS cols: id, year, month, os, browser, browser_version, region, country, city
    dimensions/drillables:
        -year, month
        -os
        -browser, browser_version
        -region, country, city
    """

    result = {
            "time": ["year", "month"],
              "os": ["id_os_name"],
         "browser": ["id_browser_name", "id_browser_version"],
        "location": ["id_region", "id_country", "id_city"],
    }
    return json.dumps(result), 200, {'content-type': 'application/json'}


# webservices
@app.route('/ws/widget-definition', methods=['GET', 'POST'])
def widget_definition():
    if request.method == 'POST':
        #TODO validation
        request_payload = json.loads(request.data)
        if not request_payload['parentClass']:
            request_payload['parentClass'] = None

        query_db('''INSERT INTO widget_definition(
                name, description, widget_class, parent_class, source
            ) VALUES(?, ?, ?, ?, ?)''', [
                request_payload[key] for key in ('name', 'description', 'widgetClass', 'parentClass', 'source')
            ]
        )

        result = query_db('SELECT * FROM widget_definition WHERE widget_class=?', [request_payload['widgetClass']], one=True)
    else:
        result = query_db('SELECT * FROM widget_definition')

    return json.dumps(result), 200, {'content-type': 'application/json'}

@app.route('/ws/widget-definition/<int:widget_id>', methods=['GET', 'PUT', 'DELETE'])
def widget_definition_id(widget_id):
    if request.method == 'PUT':
        #TODO validation
        request_payload = json.loads(request.data)
        if not request_payload['parentClass']:
            request_payload['parentClass'] = None

        query_db('UPDATE widget_definition SET name=?, description=?, widget_class=?, parent_class=?, source=? WHERE id=?',
                 [request_payload[key] for key in ('name', 'description', 'widgetClass', 'parentClass', 'source')] + [widget_id])

        result = query_db('SELECT * FROM widget_definition WHERE id=?', [widget_id], one=True)
    elif request.method == 'DELETE':
        #TODO validation
        query_db('DELETE FROM widget_definition WHERE id=?', [widget_id])

        result = {}
    else:
        result = query_db('SELECT * FROM widget_definition WHERE id=?', [widget_id], one=True)

    return json.dumps(result), 200, {'content-type': 'application/json'}

# homepage
@app.route('/')
def dashboard():
    return render_template('dashboard.html')


# initdb / runserver
if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(host='0.0.0.0', debug=True)

