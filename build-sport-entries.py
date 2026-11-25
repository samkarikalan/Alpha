"""Generate sport and Scoreboard PWA HTML shells from the one shared index.html. Run after shell edits."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent
source=(root/'index.html').read_text()
for sport,label,bg,theme in [('badminton','Badminton','#071A35','#0D2D59'),('pickleball','Pickleball','#082B24','#0B4033')]:
 folder=root/sport;folder.mkdir(exist_ok=True)
 manifest={'id':'/'+sport+'/','name':'SCS '+label,'short_name':'SCS '+label,'description':label+' club bookings, rounds and scoring','start_url':'/'+sport+'/?source=pwa','scope':'/'+sport+'/','display':'standalone','orientation':'portrait-primary','background_color':bg,'theme_color':theme,'icons':[{'src':'/'+sport+'/icon-'+size+'.png?v=V939','sizes':size+'x'+size,'type':'image/png','purpose':'any'} for size in ['192','512']]+[{'src':'/'+sport+'/icon-maskable-512.png?v=V939','sizes':'512x512','type':'image/png','purpose':'maskable'}]}
 (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 html=source.replace('<head>','<head>\n  <base href="/">',1)
 html=html.replace('href="/manifest.json?v=V921"','href="/'+sport+'/manifest.json?v=V939"',1)
 html=html.replace('href="/scs-icon-180.png?v=V921"','href="/'+sport+'/icon-180.png?v=V939"',1)
 html=html.replace('src="scs-icon-192.png?v=V921"','src="/'+sport+'/icon-192.png?v=V939"')
 html=html.replace('content="#0f0f13" id="metaThemeColor"','content="'+theme+'" id="metaThemeColor"',1)
 html=html.replace('content="CLUB Scheduler"','content="SCS '+label+'"',1)
 html=html.replace('<title>Sports Club Scheduler</title>','<title>SCS '+label+'</title>',1)
 html=html.replace('<html lang="en">','<html lang="en" data-scs-sport="'+sport+'" data-scs-sport-app="'+sport+'">',1)
 (folder/'index.html').write_text(html)
 print('Generated',sport,'PWA shell and manifest')

# The Scoreboard entry uses the same shell/scripts and selectable sport.
folder=root/'scoreboard';folder.mkdir(exist_ok=True)
manifest={'id':'/scoreboard/','name':'SCS Scoreboard','short_name':'Scoreboard','description':'Badminton and Pickleball match scoring','start_url':'/scoreboard/?source=pwa','scope':'/scoreboard/','display':'standalone','orientation':'portrait-primary','background_color':'#071A35','theme_color':'#0D2D59','icons':[{'src':'/scoreboard/icon-'+size+'.png?v=V965-R1','sizes':size+'x'+size,'type':'image/png','purpose':'any'} for size in ['192','512']]+[{'src':'/scoreboard/icon-maskable-512.png?v=V965-R1','sizes':'512x512','type':'image/png','purpose':'maskable'}]}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
html=source.replace('<head>','<head>\n  <base href="/">',1)
html=html.replace('href="/manifest.json?v=V921"','href="/scoreboard/manifest.json?v=V965-R1"',1).replace('href="/scs-icon-180.png?v=V921"','href="/scoreboard/icon-180.png?v=V965-R1"',1).replace('src="scs-icon-192.png?v=V921"','src="/scoreboard/icon-192.png?v=V965-R1"')
html=html.replace('content="CLUB Scheduler"','content="SCS Scoreboard"',1).replace('<title>Sports Club Scheduler</title>','<title>SCS Scoreboard</title>',1).replace('<html lang="en">','<html lang="en" data-scs-app="scoreboard">',1)
(folder/'index.html').write_text(html)
print('Generated scoreboard PWA shell and manifest')

# The Tournaments entry uses the same shell/scripts and selectable sport.
folder=root/'tournaments';folder.mkdir(exist_ok=True)
manifest={'id':'/tournaments/','name':'SCS Tournaments','short_name':'Tournaments','description':'Manage tournaments, events, draws and results','start_url':'/tournaments/?source=pwa','scope':'/tournaments/','display':'standalone','orientation':'portrait-primary','background_color':'#071A35','theme_color':'#0D2D59','icons':[{'src':'/tournaments/icon-'+size+'.png?v=V965-R1','sizes':size+'x'+size,'type':'image/png','purpose':'any'} for size in ['192','512']]+[{'src':'/tournaments/icon-maskable-512.png?v=V965-R1','sizes':'512x512','type':'image/png','purpose':'maskable'}]}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
html=source.replace('<head>','<head>\n  <base href="/">',1)
html=html.replace('href="/manifest.json?v=V921"','href="/tournaments/manifest.json?v=V965-R1"',1).replace('href="/scs-icon-180.png?v=V921"','href="/tournaments/icon-180.png?v=V965-R1"',1).replace('src="scs-icon-192.png?v=V921"','src="/tournaments/icon-192.png?v=V965-R1"')
html=html.replace('content="CLUB Scheduler"','content="SCS Tournaments"',1).replace('<title>Sports Club Scheduler</title>','<title>SCS Tournaments</title>',1).replace('<html lang="en">','<html lang="en" data-scs-app="tournaments">',1)
(folder/'index.html').write_text(html)
print('Generated tournaments PWA shell and manifest')
