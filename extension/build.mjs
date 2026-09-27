import {mkdir,copyFile,readdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(root,'dist'); await mkdir(dist,{recursive:true});
for(const name of await readdir(root)) {
 if(!/\.(js|html|css|json)$/.test(name) || name==='package.json') continue;
 if(name.endsWith('.js')) new Function(await readFile(path.join(root,name),'utf8'));
 await copyFile(path.join(root,name),path.join(dist,name));
}
await mkdir(path.join(dist,'icons'),{recursive:true});
await copyFile(path.join(root,'icons/128.png'),path.join(dist,'icons/128.png'));
console.log('SpendShield Live built: extension/dist (no API keys or remote code).');
