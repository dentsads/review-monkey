#!/bin/bash
# This script installs the latest nodejs and npm distribution locally in ../.nodejs

#create the .nodejs folder and cd into it
mkdir ../.nodejs
cd ../.nodejs

# Download latest nodejs distribution and unzip it in place
curl http://nodejs.org/dist/node-latest.tar.gz | tar xz --strip-components=1

# configure and make
./configure
make install

# install npm in $TMP
curl https://www.npmjs.org/install.sh | sh
