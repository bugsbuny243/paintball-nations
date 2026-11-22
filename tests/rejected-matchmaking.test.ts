/** A3 negative Colyseus network regression.
 * One server boot per test process: @colyseus/testing and the matchmaker use shared global state.
 * Hold a valid seat while checking denied joins so autoDispose cannot remove the room.
 * Not proof of production authentication, abuse protection or load readiness.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boot} from '@colyseus/testing';
import {onlineServer} from '../apps/game-backend/src/online-server.ts';
import {issueGuestTicket} from '../apps/game-backend/src/auth/guest-ticket.ts';

test('A3 rejects missing/forged guest passes on the network without breaking active players',
  {timeout:25000},async()=>{
  const server=await boot(onlineServer);
  let keeper:null|{leave:()=>Promise<unknown>}=null;
  let second:null|{leave:()=>Promise<unknown>}=null;
  try{
    const room=await server.createRoom('macka_frontline');
    // A live, authenticated seat prevents the empty room from being auto-disposed.
    keeper=await server.connectTo(room,{guestTicket:issueGuestTicket().ticket});
    assert.equal(room.game.snapshot().players.length,1);

    await assert.rejects(server.connectTo(room,{}),
      /auth|reject|invalid|525|401|forbidden/i);
    await assert.rejects(server.connectTo(room,{guestTicket:'forged-ticket'}),
      /auth|reject|invalid|525|401|forbidden/i);

    // No denied client was admitted and the original match stays available.
    assert.equal(room.game.snapshot().players.length,1);
    assert.equal(room.game.snapshot().bots,0);
    second=await server.connectTo(room,{guestTicket:issueGuestTicket().ticket});
    assert.equal(room.game.snapshot().players.length,2);
    assert.equal(room.game.snapshot().playerCounts.blue,1);
    assert.equal(room.game.snapshot().playerCounts.red,1);
  }finally{
    await Promise.allSettled([keeper,second].filter((v):v is {leave:()=>Promise<unknown>}=>v!==null)
      .map(c=>c.leave()));
    await server.shutdown();
  }
});
