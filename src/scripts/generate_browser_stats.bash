#!/bin/bash

rdbms=${1:?Missing RDBMS}
if [[ $1 == mysql ]]; then
    autoincrement=AUTO_INCREMENT
elif [[ $1 == sqlite ]]; then
    autoincrement=AUTOINCREMENT
else
    echo "Unrecognized RBDMS: $1" >&2
    exit 1
fi

echo "BEGIN;"
echo "DROP TABLE IF EXISTS ds_browser_stats;"
echo "CREATE TABLE ds_browser_stats (id INTEGER PRIMARY KEY $autoincrement, year INTEGER NOT NULL, month INTEGER NOT NULL, os TEXT NOT NULL, browser TEXT, browser_version TEXT, region TEXT NOT NULL, country TEXT NOT NULL, city TEXT);"

if [[ $rdbms == mysql ]]; then
    echo "INSERT INTO ds_browser_stats(year, month, os, browser, browser_version, region, country, city) VALUES";
fi
for ((i=1; i<=${2:?Missing row count}; i++)); do
    year=$(($RANDOM % 3 + 2000))
    month=$(($RANDOM % 12 + 1))

    os=$(($RANDOM % 14))
    if (($os==0)); then
        os=1
    elif (($os<=4)); then
        os=2
    else
        os=3
    fi

    browser=$(($RANDOM % 16))
    if (($browser==0)); then
        browser=NULL
    elif (($browser<=2)); then
        browser=1
    elif (($browser<=2+4)); then
        browser=2
    elif (($browser<=2+4+8)); then
        browser=3
    else
        browser=4
    fi
    if [[ $browser == NULL ]]; then
        browser_version=NULL
    else
        browser_version=$(($RANDOM % ($browser*4) + 1))
    fi

    region=$(($RANDOM % 5 + 1))
    country=$(($RANDOM % (10*$region) + 10*$region))
    city=$(($RANDOM % 11))
    if (($city==10)); then
        city=NULL
    else
        let "city+=$region*10"
    fi

    if [[ $rdbms == mysql ]]; then
        echo -n "($year, $month, $os, $browser, $browser_version, $region, $country, $city)";
        if (($i==$2)); then
            echo ";"
        else
            echo ","
        fi
    elif [[ $rdbms == sqlite ]]; then
        echo "INSERT INTO ds_browser_stats(year, month, os, browser, browser_version, region, country, city) VALUES ($year, $month, $os, $browser, $browser_version, $region, $country, $city);";
    fi
done
echo "COMMIT;"
