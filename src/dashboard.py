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
DATABASE = 'dashboard.db'

def init_db():
    with closing(connect_db()) as db:
        with app.open_resource('schema.sql') as f:
            db.cursor().executescript(f.read())
        db.commit()

def connect_db():
    return sqlite3.connect(DATABASE)

def query_db(query, args=(), one=False):
    cur = g.db.execute(query, args)
    g.db.commit()
    rv = [dict((cur.description[idx][0], value) for idx, value in enumerate(row)) for row in cur.fetchall()]
    return (rv[0] if rv else None) if one else rv


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
        query_db('insert into widget_definition(name, description, dimensions, depth, multiseries, source) values(?, ?, ?, ?, ?, ?)',
                 [request_payload[key] for key in ('name', 'description', 'dimensions', 'depth', 'multiseries', 'source')])

        result = {}
    else:
        result = query_db('select * from widget_definition')

    return json.dumps(result), 200, {'content-type': 'application/json'}

@app.route('/ws/widget-definition/<int:widget_id>', methods=['GET', 'PUT', 'DELETE'])
def widget_definition_id(widget_id):
    if request.method == 'PUT':
        #XXX should use id from payload or from url?
        #TODO validation
        request_payload = json.loads(request.data)
        query_db('update widget_definition set name=?, description=?, dimensions=?, depth=?, multiseries=?, source=? where id=?',
                 [request_payload[key] for key in ('name', 'description', 'dimensions', 'depth', 'multiseries', 'source', 'id')])

        result = {}
    elif request.method == 'DELETE':
        #TODO validation
        query_db('delete from widget_definition where id=?', [widget_id])

        result = {}
    else:
        result = query_db('select * from widget_definition where id = ?', [widget_id], one=True)

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

