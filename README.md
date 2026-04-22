## Connecting to drift-tide

`ssh root@134.199.138.170`

## Deployment

Push to git, then pull from drifttide. Then run `docker compose restart ` or something like that.

## Adding Music to Navidrome

First, open files.drift-tide.com. Then go to the music-import folder. Drop the files into the music import folder.

Then SSH intto drifttide

Beets is already configured in drifttide.

If you are importing folders organized by album or artist, run this command: `beet import /mnt/drifttide_volume/music_import`
If you are improting just mp3 files with not folders: `beet import -s /mnt/drifttide_volume/music_import`
