#!/bin/bash
# This script installs the latest nodejs and npm distribution locally in ../.nodejs

#create the .nodejs folder and cd into it
mkdir ../.nodejs
cd ../.nodejs

# Download latest nodejs distribution and unzip it in place
curl http://nodejs.org/dist/v0.12.2/node-v0.12.2-linux-x64.tar.gz | tar xz --strip-components=1

export PATH=$PATH:bin

