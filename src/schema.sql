CREATE TABLE widget_definition (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    widget_class TEXT UNIQUE NOT NULL CHECK(CASE widget_class WHEN '' THEN 0 END),
    parent_class TEXT CHECK(CASE parent_class WHEN widget_class THEN 0 END),
    source       TEXT NOT NULL,
    FOREIGN KEY(parent_class) REFERENCES widget_definition(widget_class)
);
