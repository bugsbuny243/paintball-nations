/** A2 experimental Colyseus network process.
 * The existing PostgreSQL World API remains a separately tested A1 service.
 * Do not expose this unauthenticated test room as a production game.
 */
import {defineRoom,defineServer} from 'colyseus';
import {pathToFileURL} from 'node:url';
import {MackaFrontlineRoom} from './rooms/macka-room.ts';

export const onlineServer=defineServer({
  rooms:{
    macka_frontline:defineRoom(MackaFrontlineRoom)
  },
  gracefullyShutdown:true
});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.NODE_ENV==='production'){
    throw new Error('A2 is unauthenticated: production disabled until identity and authorization are implemented.');
  }
  const port=Number(process.env.PORT||2567);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT');
  onlineServer.listen(port);
  console.log('Paintball Nations experimental Maçka multiplayer on port '+port);
}
