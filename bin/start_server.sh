#!/bin/bash

REVIEW_MONKEY_HOME=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
NODE="${NODE_PATH}"


if [ "x$NODE" = "x" ]; then
  NODE="$REVIEW_MONKEY_HOME/.nodejs"
  export PATH=$PATH:$NODE
fi

command -v node >/dev/null 2>&1 || { echo >&2 "Cannot find 'node' in PATH env variable. It seems to not be installed.
 Please install it. Aborting."; exit 1; }
command -v npm -v >/dev/null 2>&1 || { echo >&2 "Cannot find 'npm' in PATH env variable. It seems to not be installed.
 Please install it. Aborting."; exit 1; }

npm install
node $REVIEW_MONKEY_HOME/server.js
