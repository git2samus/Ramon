#!/usr/bin/env python
import os, sqlite3
from contextlib import closing
from functools import wraps
from random import random
from copy import copy
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
        'series':       'series',
        'dimensions':   'dimensions',
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

def json_response(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        result = f(*args, **kwargs)
        return json.dumps(result), 200, {'content-type': 'application/json'}
    return wrapper


def generate_series(series, dimensions, max_value=10, min_value=0):
    if len(series) > 0:
        serie = series.pop(0)
        if serie.isdigit():
            labels = [n+1 for n in range(int(serie))]
        else:
            labels = serie.split('|')

        return [
            {'label': label, 'data': generate_series(copy(series), dimensions)}
            for label in labels
        ]
    else:
        return [
            (max_value-min_value) * random() + min_value
            for _ in range(dimensions)
        ]

# test datasource
@app.route('/ds/test', methods=['GET', 'OPTIONS'])
@json_response
def test_datasource():
    series     = request.args.get('series').split(',')
    dimensions = int(request.args.get('dimensions'))
    max_value  = int(request.args.get('maxValue', '10'))
    min_value  = int(request.args.get('minValue',  '0'))

    if request.method == 'OPTIONS':
        return {
            'series': len(series), 'dimensions': dimensions,
        }

    return generate_series(series, dimensions, max_value, min_value)


# webservices
@app.route('/ws/widget-definition', methods=['GET', 'POST'])
@json_response
def widget_definition():
    if request.method == 'POST':
        #TODO validation
        request_payload = json.loads(request.data)
        if not request_payload['parentClass']:
            request_payload['parentClass'] = None

        query_db('''INSERT INTO widget_definition(
                name, description, series, dimensions, widget_class, parent_class, source
            ) VALUES(?, ?, ?, ?, ?, ?, ?)''', [
                request_payload[key] for key in ('name', 'description', 'series', 'dimensions', 'widgetClass', 'parentClass', 'source')
            ]
        )

        result = query_db('SELECT * FROM widget_definition WHERE widget_class=?', [request_payload['widgetClass']], one=True)
    else:
        result = query_db('SELECT * FROM widget_definition')

    return result

@app.route('/ws/widget-definition/<int:widget_id>', methods=['GET', 'PUT', 'DELETE'])
@json_response
def widget_definition_id(widget_id):
    if request.method == 'PUT':
        #TODO validation
        request_payload = json.loads(request.data)
        if not request_payload['parentClass']:
            request_payload['parentClass'] = None

        query_db('UPDATE widget_definition SET name=?, description=?, series=?, dimensions=?, widget_class=?, parent_class=?, source=? WHERE id=?',
                 [request_payload[key] for key in ('name', 'description', 'series', 'dimensions', 'widgetClass', 'parentClass', 'source')] + [widget_id])

        result = query_db('SELECT * FROM widget_definition WHERE id=?', [widget_id], one=True)
    elif request.method == 'DELETE':
        #TODO validation
        query_db('DELETE FROM widget_definition WHERE id=?', [widget_id])

        result = None
    else:
        result = query_db('SELECT * FROM widget_definition WHERE id=?', [widget_id], one=True)

    return result

# homepage
@app.route('/')
def dashboard():
    return render_template('dashboard.html')


# initdb / runserver
if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(host='0.0.0.0', debug=True)

