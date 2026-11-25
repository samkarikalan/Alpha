/* Traditional doubles pickleball. No DOM or persistence dependencies. */
(function(root,factory){
 var rules=factory();
 if(typeof module==='object'&&module.exports)module.exports=rules;
 else root.SCSPickleballScoring=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function team(player){return player<2?0:1;}
 function partner(player){return player%2===0?player+1:player-1;}
 function positions(server,receiver){
  var result=[[],[]];result[team(server)]=[server,partner(server)];result[team(receiver)]=[receiver,partner(receiver)];return result;
 }
 function initialise(state){
  state.sport='pickleball';state.scoringMode='side-out';state.serverNumber=2;
  state.server=state.initialServer;state.positions=positions(state.initialServer,state.initialReceiver);
 }
 function call(state){var serving=team(state.server);return state.score[serving]+'–'+state.score[1-serving]+'–'+state.serverNumber;}
 function rally(state,winner){
  if(state.finished||!(winner===0||winner===1))return;
  var serving=team(state.server),player=state.server,event='point';
  if(winner===serving){
   state.score[serving]++;
   state.positions[serving].reverse();
  }else if(state.serverNumber===1){
   state.server=partner(state.server);state.serverNumber=2;event='second-server';
  }else{
   state.server=state.positions[1-serving][0];state.serverNumber=1;event='side-out';
  }
  state.entries.push({player:player,score:state.score[serving],team:serving,rallyWinner:winner,event:event,server:state.server,serverNumber:state.serverNumber});
  var target=state.setRules[state.currentSet-1].win;
  if(Math.max(...state.score)<target||Math.abs(state.score[0]-state.score[1])<2)return;
  var gameWinner=state.score[0]>state.score[1]?0:1;
  state.completedSets.push({set:state.currentSet,score:state.score.slice(),winner:gameWinner,server:state.server,serverNumber:state.serverNumber,initialServer:state.initialServer,initialReceiver:state.initialReceiver,positions:state.positions.map(x=>x.slice()),entries:state.entries.map(x=>Object.assign({},x))});
  state.setWins[gameWinner]++;
  state.finished=state.setWins[gameWinner]>=(state.matchSets===3?2:1);
  if(!state.finished){
   state.currentSet++;state.score=[0,0];state.entries=[];
   // The first-serving team alternates between games. Reset to 0–0–2.
   var previousServer=state.initialServer;state.initialServer=state.initialReceiver;state.initialReceiver=previousServer;
   initialise(state);
  }
 }
 return {initialise:initialise,rally:rally,call:call};
});
