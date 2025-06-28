#!/bin/sh

yarn run cli movie scripts/test/test_media.json
yarn run cli movie scripts/test/test_movie.json
yarn run cli movie scripts/test/test_beats.json

yarn run cli movie scripts/snakajima/digital_democracy.json
yarn run cli movie scripts/test/test_spillover.json
