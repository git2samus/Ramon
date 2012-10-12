#!/usr/bin/env python
import os, json, sqlite3
from contextlib import closing
from flask import Flask, render_template, g, request

app = Flask(__name__)


DATABASE = 'dashboard.db'

def init_db():
    with closing(connect_db()) as db:
        with app.open_resource('schema.sql') as f:
            db.cursor().executescript(f.read())
        db.commit()

def connect_db():
    return sqlite3.connect(DATABASE)

def query_db(query, args=(), one=False):
    c = g.db.cursor()
    q = c.execute(query, args)
    g.db.commit()

    rv = [dict((q.description[idx][0], value) for idx, value in enumerate(row)) for row in q.fetchall()]
    return (rv[0] if rv else None) if one else rv


'''
@app.before_request
def before_request():
    g.db = connect_db()

@app.teardown_request
def teardown_request(exception):
    if hasattr(g, 'db'):
        g.db.close()
'''


@app.route('/ws/widget-definition/', methods=['POST'])
def widget_definition():
    #TODO validation
    request_payload = json.loads(request.data)
    with closing(connect_db()) as db:
        db.cursor().execute('insert into widget_definition(name, description, dimensions, source) values(?, ?, ?, ?)',
                            [request_payload[key] for key in ('name', 'description', 'dimensions', 'source')])
        db.commit()

    return '', 200, {'content-type': 'application/json'}

@app.route('/')
def dashboard():
    return render_template('dashboard.html')


if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True)
