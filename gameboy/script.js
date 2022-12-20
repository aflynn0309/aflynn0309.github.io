var font=new Image();
font.src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAICAYAAAAGP/oPAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAALRJREFUeNrsVtsOgCAIleZ/V19u88HNUdwCrQfZelA8x4gDBCmlIy37zHIUUSll79cAcFJnOB+F1/BTd2Cslf8JL53R8kNEBeCgpY9AvRyF1/Bzd3CJ1/it8VrWeVap1cs0StIqTVKYVKVSFVqS1WLT4LFtf+mFLQBJjVhFGgXX/f7h2hLnl5JP4fs9zJs9pRg9P7wtAidldhzWKr7NAE8CPEM4YsiNHMIjfyJChvCy93YJMAD0L/qXa2HkvgAAAABJRU5ErkJggg==";

function fullScreen(e){
  var d= document;
  if (null!=(d.fullscreenElement || d.mozFullScreenElement || d.webkitFullscreenElement || d.msFullscreenElement)) {
    (d.exitFullscreen || d.mozCancelFullScreen || d.webkitExitFullscreen || d.msExitFullscreen).apply(d);
  } else {
    showDebug(false);
    (e.requestFullscreen || e.mozRequestFullScreen || e.webkitRequestFullscreen || e.msRequestFullscreen || (()=>{})).apply(e);
  }
}

var dpixels = new Uint8Array(160*144);

var limitFrameRate = true;
var showFrameRate = false;

var dctx = document.getElementById('display').getContext('2d');

var dImgData = dctx.getImageData(0,0,160,144);

for (i=0;i<160*144;i++){
  dImgData.data[4*i+3] = 255
}

dctx.putImageData(dImgData,0,0)


var lastSampleTime = 0;
var frame = 0;
var frameRate = 0;
const sampleFrames = 5;

function renderDisplayCanvas() {
  //  0  White
  //  1  Light gray
  //  2  Dark gray
  //  3  Black

  var R = [224,136,52, 8 ],
      G = [248,192,104,24],
      B = [208,112,86, 32];

  for (var i=0,j=0;i<160*144;i++){
    dImgData.data[j++ ] = R[dpixels[i]]
    dImgData.data[j++ ] = G[dpixels[i]]
    dImgData.data[j   ] = B[dpixels[i]]
    j+=2
  }
  dctx.putImageData(dImgData,0,0)

  if (++frame >= sampleFrames){
    frame = 0;
    frameRate = ((1000 * sampleFrames / (thisFrame - lastSampleTime)) + frameRate)/2;
    lastSampleTime = thisFrame;
  }

  if(showFrameRate) {
    var t=frameRate.toFixed(2);
    for (var c in t) {
      dctx.drawImage(font, (t[c].charCodeAt(0)-46)*8, 0, 8,8,c*8,0,8,8)
    }
    
  }
}




// We have infinite RAM
const pixelDecoder=[]
for (var d1 = 0; d1<256; d1++) {
  pixelDecoder[d1]=[]
  for (var d2 = 0; d2<256; d2++)
    pixelDecoder[d1][d2] = [
      ((d1&128)+ 2*(d2&128)) >>7,
      ((d1&64) + 2*(d2&64)) >>6,
      ((d1&32) + 2*(d2&32)) >>5,
      ((d1&16) + 2*(d2&16)) >>4,
      ((d1&8)  + 2*(d2&8)) >>3,
      ((d1&4)  + 2*(d2&4)) >>2,
      ((d1&2)  + 2*(d2&2)) >>1,
      ((d1&1)  + 2*(d2&1))
    ]
}


// LFSR prescaler lookups
const snd4bit4 = [ // 3-bit "shift clock frequency"
  2,
  4,
  8,
  16,
  32,
  64,
  128,
  256,
  512,
  1024,
  2048,
  4096,
  8192,
  16384,
  16384,// Prohibited code
  16384 // Prohibited code
]
const snd4bit3 = [ // 4 bit "prescaler input clock" (14 step)
  4 /4194304,
  8 /4194304,
  16/4194304,
  24/4194304,
  32/4194304,
  40/4194304,
  48/4194304,
  56/4194304
]

var SoundEnabled = false;
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const FFTsize = 512
var reverseTable = new Uint32Array(FFTsize);
var lfsr7bit = new Float32Array(127), lfsr15bit=new Float32Array(32767);
(function(){
  var limit = 1,  bit = FFTsize >> 1;
  
  // reverse table for FFT
  while ( limit < FFTsize ) {
    for ( i = 0; i < limit; i++ ) {
      reverseTable[i + limit] = reverseTable[i] + bit;
    }
    limit = limit << 1;
    bit = bit >> 1;
  }

  // precalculate LFSR patterns
  var start_state = 127;
  var lfsr = start_state;
  var st=0

  do {
    bit  = ((lfsr >> 0) ^ (lfsr >> 1) ) & 1;
    lfsr =  (lfsr >> 1) | (bit << 6);
    lfsr7bit[st++]=(bit/4-0.125);
  } while (lfsr != start_state); // has a period of 127

  st=0;
  do {
    bit  = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
    lfsr =  (lfsr >> 1) | (bit << 14);
    lfsr15bit[st++]=(bit/4-0.125);
  } while (lfsr != start_state); // period of 32767

})();
function setSound3Waveform() {
  if (!sound[3].waveChanged) return;
  var i, real = new Float32Array(FFTsize), imag = new Float32Array(FFTsize), samples=new Float32Array(FFTsize);

  // sufficiently square edges!
  for ( i = 0; i < 16; i++ ) {
     samples[32*i+0] = 
     samples[32*i+1] = 
     samples[32*i+2] = 
     samples[32*i+3] = 
     samples[32*i+4] = 
     samples[32*i+5] = 
     samples[32*i+6] = 
     samples[32*i+7] = 
     samples[32*i+8] = 
     samples[32*i+9] = 
     samples[32*i+10] = 
     samples[32*i+11] = 
     samples[32*i+12] = 
     samples[32*i+13] = 
     samples[32*i+14] = 
     samples[32*i+15] = 
      MEM[0xFF30 + i]>>4;
     samples[32*i+16] = 
     samples[32*i+17] = 
     samples[32*i+18] = 
     samples[32*i+19] = 
     samples[32*i+20] = 
     samples[32*i+21] = 
     samples[32*i+22] = 
     samples[32*i+23] = 
     samples[32*i+24] = 
     samples[32*i+25] = 
     samples[32*i+26] = 
     samples[32*i+27] = 
     samples[32*i+28] = 
     samples[32*i+29] = 
     samples[32*i+30] = 
     samples[32*i+31] = 
      MEM[0xFF30 + i]&0x0F;
  }

  
  for ( i = 0; i < FFTsize; i++ ) {
    real[i] = samples[reverseTable[i]]/4096;
    imag[i] = 0;
  }
  
  var halfSize = 1,
    phaseShiftStepReal,
    phaseShiftStepImag,
    currentPhaseShiftReal,
    currentPhaseShiftImag,
    off,
    tr,
    ti,
    tmpReal;

  while ( halfSize < FFTsize ) {
    phaseShiftStepReal = Math.cos(-3.141592653589793/halfSize);
    phaseShiftStepImag = Math.sin(-3.141592653589793/halfSize);
    currentPhaseShiftReal = 1.0;
    currentPhaseShiftImag = 0.0;

    for ( var fftStep = 0; fftStep < halfSize; fftStep++ ) {
      i = fftStep;

      while ( i < FFTsize ) {
        off = i + halfSize;
        tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
        ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

        real[off] = real[i] - tr;
        imag[off] = imag[i] - ti;
        real[i] += tr;
        imag[i] += ti;

        i += halfSize << 1;
      }

      tmpReal = currentPhaseShiftReal;
      currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
      currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
    }
    halfSize = halfSize << 1;
  }
  sound[3].oscillator.setPeriodicWave(
    audioCtx.createPeriodicWave(real.slice(0,FFTsize/2),imag.slice(0,FFTsize/2), {disableNormalization:true})
  );
  sound[3].waveChanged=false;
};


const sound = {
  1:{ // Square / Pulse with sweep and envelope
    oscillator:audioCtx.createOscillator(),
    freq: function(f) { sound[1].oscillator.frequency.setValueAtTime(f, audioCtx.currentTime) },
    duty: function(d) { sound[1].oscillator.setPeriodicWave( sound.pulses[d] ) },
    sweepTime: 0,
    sweepDir: 1,
    sweepShift: 0,
    sweepPrescaler: 0,
    freqnum: 0
  },
  2:{ // Square / Pulse with envelope
    oscillator:audioCtx.createOscillator(),
    freq: function(f) { sound[2].oscillator.frequency.setValueAtTime(f, audioCtx.currentTime) },
    duty: function(d) { sound[2].oscillator.setPeriodicWave( sound.pulses[d] ) }
  },
  3:{ // Wave playback
    oscillator:audioCtx.createOscillator(),
    freq: function(f) { sound[3].oscillator.frequency.setValueAtTime(f, audioCtx.currentTime) },
    waveChanged:true
  },
  4:{ //Noise
    oscillator:audioCtx.createScriptProcessor(2048, 1, 1),
    polySteps:function(x){ lfsrPhase=0;sound[4].oscillator.onaudioprocess = x?processLFSR7bit:processLFSR15bit; },
    bitPeriod:1,
    freq:function(bits4, bits3){ 
      sound[4].bitPeriod=(audioCtx.sampleRate * snd4bit4[bits4] * snd4bit3[bits3])
    }
  }
}

function generatePulseWave(duty){
  var res = 256; // up to 8192 according to spec
  var real = new Float32Array(res);
  var imag = new Float32Array(res);

  real[0] = 0.5*duty;
  for (var n = 1; n<res; n++) {
    real[n] = 0.5*Math.sin( 3.141592653589793*n*duty )/(1.570796326794896*n)
  }
  return audioCtx.createPeriodicWave(real,imag, {disableNormalization:true});
}

sound.pulses = [
  generatePulseWave(0.125),
  generatePulseWave(0.25),
  generatePulseWave(0.5),
  generatePulseWave(0.75)
]

var lfsrPhase=0;
var processLFSR7bit=function(e){
  var output = e.outputBuffer.getChannelData(0);
  var j=1/sound[4].bitPeriod;

  for (var i = 0; i < 2048; i++) {
    lfsrPhase+=j
    if (lfsrPhase>127) lfsrPhase=0;
    
    output[i] = lfsr7bit[ ~~lfsrPhase ]
  }

}
var processLFSR15bit=function(e){
  var output = e.outputBuffer.getChannelData(0);
  var j=Math.ceil(sound[4].bitPeriod);
  
  for (var i = 0; i < 2048; i+=j) {
    if ((++lfsrPhase)>=32767) lfsrPhase-=32767;
    var s = lfsr15bit[ lfsrPhase ]
    for (var p=j;p--;) output[i+p] = s;
  }
}



sound.SO1 = audioCtx.createGain()
sound.SO2 = audioCtx.createGain()

for (var i=1;i<=4;i++){
  sound[i].gainNode=audioCtx.createGain()
  sound[i].amp=function(a) { this.gainNode.gain.setValueAtTime(a, audioCtx.currentTime) }
  sound[i].amp(0)
  sound[i].oscillator.connect(sound[i].gainNode)
  sound[i].gainNode.connect(sound.SO1)
  sound[i].gainNode.connect(sound.SO2)

  sound[i].initialized = false;
  sound[i].lengthEnabled = false;
  sound[i].length = 0;
  sound[i].env = 0;
  sound[i].envSpeed = 0;
  sound[i].envDirection = 0;
  sound[i].envCounter = 0;
}

sound[1].oscillator.start()
sound[2].oscillator.start()
sound[3].oscillator.start()
sound[4].oscillator.onaudioprocess = processLFSR15bit;

sound.final = audioCtx.createChannelMerger(2)
sound.SO1.connect(sound.final, 0, 1)
sound.SO2.connect(sound.final, 0, 0)

sound.final.connect(audioCtx.destination)

audioCtx.suspend()


/*
Memory map

	$FFFF       	Interrupt Enable Flag
	$FF80-$FFFE 	HRAM - 127 bytes
	$FF00-$FF7F 	Hardware I/O Registers
	$FEA0-$FEFF 	Unusable Memory
	$FE00-$FE9F 	OAM - Object Attribute Memory
	$E000-$FDFF 	Echo RAM - Reserved, Do Not Use
	$D000-$DFFF 	Internal RAM - Bank 1-7 (switchable - CGB only)
	$C000-$CFFF 	Internal RAM - Bank 0 (fixed)
	$A000-$BFFF 	Cartridge RAM (If Available)
	$9C00-$9FFF 	BG Map Data 2
	$9800-$9BFF 	BG Map Data 1
	$8000-$97FF 	Character RAM
	$4000-$7FFF 	Cartridge ROM - Switchable Banks 1-xx
	$0150-$3FFF 	Cartridge ROM - Bank 0 (fixed)
	$0100-$014F 	Cartridge Header Area
	$0000-$00FF 	Restart and Interrupt Vectors

Bank switch:  write bank number to $2000 

  Cartridge RAM has separate bank number to cartridge ROM


Bootcode: 
  load first bank of rom into MEM
  overwrite first 256 bytes with bootcode
  after verification, overwrite first 256 bytes with data from rom

*/










var MEM = new Uint8Array(0x10000); // Main address space
var FirstROMPage, ROM = new Uint8Array(512); //populate later
var ROMbank = 1; 
var ROMbankoffset = (ROMbank-1)*0x4000;

var cartRAM = new Uint8Array(0x8000); // some carts have up to 128K of ram?
var RAMbank =0; 
var RAMbankoffset = RAMbank*0x2000 - 0xA000;
var RAMenabled=false;
var MBCRamMode=0; //for MBC1

var divPrescaler=0, timerPrescaler=0, timerLength=1, timerEnable=false;
var LCD_enabled = false, LCD_lastmode=1, LCD_scan=0;
var joypad_dpad = 0xef, joypad_buttons=0xdf; // 0=pressed
var keys_dpad = 0xef, keys_buttons=0xdf; // 0=pressed

document.onkeydown=function(e){
  switch (e.keyCode){
    case 38: //Up
      if (!requestStop) {e.preventDefault(); e.stopPropagation();}
      keys_dpad &=~(1<<2); break;
    case 40: //Down
      if (!requestStop) {e.preventDefault(); e.stopPropagation();}
      keys_dpad &=~(1<<3); break;
    case 37: //Left
      keys_dpad &=~(1<<1); break;
    case 39: //Right
      keys_dpad &=~(1<<0); break;
    case 83: //A
      keys_buttons &=~(1<<0); break;
    case 65: //B
      keys_buttons &=~(1<<1); break;
    case 13: //Start
      keys_buttons &=~(1<<3); break;
    case 16: //Select
      keys_buttons &=~(1<<2); break;
  }
}
document.onkeyup=function(e){
  switch (e.keyCode){
    case 38: //Up
      keys_dpad |=(1<<2); break;
    case 40: //Down
      keys_dpad |=(1<<3); break;
    case 37: //Left
      keys_dpad |=(1<<1); break;
    case 39: //Right
      keys_dpad |=(1<<0); break;
    case 83: //A
      keys_buttons |=(1<<0); break;
    case 65: //B
      keys_buttons |=(1<<1); break;
    case 13: //Start
      keys_buttons |=(1<<3); break;
    case 16: //Select
      keys_buttons |=(1<<2); break;
  }
}
var doGamepad = function(){};
// gamepad localstorage type: 0 for button, 1 for axes neg, 2 for axes pos

var gamepad={
  ctrl:["up","down","left","right","A","B","start","select","FastForward"],
  layout:{},
  text:document.getElementById("gamepadText"),
  config:function(){
    if (gamepad.text.innerHTML) return
    var gp=navigator.getGamepads();
    var nogamepads=true;
    var inuseAP=[],inuseAN=[],inuseB=[];
    for (var i=gp.length;i--;) {
      if (gp[i]!==null) nogamepads=false;
      inuseAP[i]=[],inuseAN[i]=[],inuseB[i]=[];
    }
    var learnstate=0;
    if (nogamepads) {
      alert("No Gamepads found. Connect One then Refresh")
      return;
    }

    gamepad.text.innerHTML="Press button for "+gamepad.ctrl[learnstate];

    function setSingle(gpid, type, n){
      if (learnstate>=gamepad.ctrl.length) return
      gamepad.layout[gamepad.ctrl[learnstate]]={gpid,type,n};

      learnstate++
      gamepad.text.innerHTML=learnstate>=gamepad.ctrl.length?
        "":"Press button for "+gamepad.ctrl[learnstate];
    }
    var wait=function(){
      gp=navigator.getGamepads();
      for (var i=gp.length;i--;) {
        if (!gp[i]) continue;
        for (var j=gp[i].buttons.length;j--;) {
          if (gp[i].buttons[j].pressed && !inuseB[i][j]) {
            inuseB[i][j]=true
            setSingle(i, 0, j)
          }
        }
        for (var j=gp[i].axes.length;j--;) {
          if (gp[i].axes[j]>0.3 && !inuseAP[i][j]) {
            inuseAP[i][j]=true
            setSingle(i, 2, j)
          } else if (gp[i].axes[j]<-0.3 && !inuseAN[i][j]) {
            inuseAN[i][j]=true
            setSingle(i, 1, j)
          }
        }
      }
      if (learnstate<gamepad.ctrl.length) setTimeout(wait,20)
      else gamepad.set(),localStorage.gamepad=JSON.stringify(gamepad.layout);
    }
    setTimeout(wait,20)
  },

  set:function(){
    var gp=navigator.getGamepads(), o=gamepad.layout ||{};
    for (var i of gamepad.ctrl) {
      gamepad[i]=()=>false;
      if (!o[i] || !o[i].hasOwnProperty("gpid") || !gp[o[i].gpid]) continue;
      let id=o[i].gpid, n=o[i].n;
      if (o[i].type==0 && gp[id].buttons.length>n) {
        gamepad[i]=(g)=>g[id].buttons[n].pressed;
      } else if (o[i].type==1 && gp[id].axes.length>n) {
        gamepad[i]=(g)=>g[id].axes[n]<-0.3;
      } else if (o[i].type==2 && gp[id].axes.length>n) {
        gamepad[i]=(g)=>g[id].axes[n]>0.3;
      }
    }
    var ff=!limitFrameRate;
    doGamepad = function (){
      var gp=navigator.getGamepads();
      joypad_dpad=
         (gamepad.right(gp)?0:1)
        +(gamepad.left(gp) ?0:2)
        +(gamepad.up(gp)   ?0:4)
        +(gamepad.down(gp) ?0:8);

      joypad_buttons=
         (gamepad.A(gp)     ?0:1)
        +(gamepad.B(gp)     ?0:2)
        +(gamepad.select(gp)?0:4)
        +(gamepad.start(gp) ?0:8);

      var gff=gamepad.FastForward(gp);
      if (gff!=ff) limitFrameRate=!(ff=gff)
    };
  }
}

if (localStorage.gamepad) gamepad.layout=JSON.parse(localStorage.gamepad);
window.addEventListener("gamepadconnected", gamepad.set);
window.addEventListener("gamepaddisconnected", gamepad.set);


function readMem(addr){
  if (addr <= 0x3fff) return ROM[ addr ];
  if (addr <= 0x7fff) return ROM[ addr + ROMbankoffset ];

  // Cartridge RAM
  if (addr >= 0xA000 && addr <=0xBFFF) return cartRAM[ addr + RAMbankoffset ];

  // Joypad
  if (addr==0xFF00) {
    if (MEM[0xFF00]&0x20) {
      return joypad_dpad & keys_dpad
    } else if (MEM[0xFF00]&0x10) {
      return joypad_buttons & keys_buttons
    } else return 0xFF;
  }

  return MEM[addr];
}

function readMem16(addr){
  //just presuming that some peripherals will need to hook on 16 bits
  return [readMem(addr+1),readMem(addr)]
}

function writeMem(addr, data){
  if (addr<=0x7fff) { 
    doMBC(addr, data);
    return;
  }

  if (addr >= 0xA000 && addr <=0xBFFF && RAMenabled){
    cartRAM[ addr + RAMbankoffset ] = data;
    return
  }

  //DIV register: reset
  if (addr==0xFF04) {MEM[0xFF04]=0;return;}
  // Timer control
  if (addr==0xFF07) {
    timerEnable = ((data&(1<<2))!=0);
    timerLength = [ 1024, 16, 64, 256 ][ data&0x3 ];
    timerPrescaler=timerLength; //+cycles for this instruction?
    MEM[addr] = 0xF8|data;
    return;
  }

  // Sound Control
  if (addr==0xFF26) {
    if (data&(1<<7)) {
      MEM[0xFF26]=data&(1<<7);
      SoundEnabled = true;
      audioCtx.resume()
    } else {
      SoundEnabled = false;
      // should we set each oscillator to amplitude zero too?
      audioCtx.suspend()
      // Zero all sound registers
      resetSoundRegisters();
    }
    return;
  }
  if (addr>=0xFF10 && addr <=0xFF25) {
    if (!SoundEnabled) return;
    // FF10 - NR10 - Channel 1 Sweep register (R/W)
    if (addr == 0xFF10) {
      sound[1].sweepTime = (data>>4)&0x7;
      sound[1].sweepPrescaler = sound[1].sweepTime;
      sound[1].sweepDir = (data&(1<<3)) ? 0 : 1;
      sound[1].sweepShift = data&0x7;
      MEM[addr] = data &0x80
      return;
    }
    // FF11 - NR11 - Channel 1 Sound length/Wave pattern duty (R/W)
    if (addr == 0xFF11) {
      MEM[addr] = data;
      sound[1].duty(data>>6)
      return;
    }
    // FF12 - NR12 - Channel 1 Volume Envelope (R/W)
    if (addr == 0xFF12) {
      MEM[addr] = data
      sound[1].envDirection = (data&(1<<3)) ? 1: -1;
      sound[1].envSpeed = data&0x7;
      sound[1].envCounter = 0;
      return;
    }
    // FF13 - NR13 - Channel 1 Frequency lo (Write Only)
    if (addr == 0xFF13) {
      sound[1].freqnum=(((MEM[0xFF14]&0x7)<<8)+ data);
      sound[1].freq(  131072/(2048-  sound[1].freqnum  )  )
      MEM[addr] = data
      return;
    }
    // FF14 - NR14 - Channel 1 Frequency hi (R/W)
    if (addr == 0xFF14) {
      //bit 7 is initialize
      sound[1].freqnum=(((data&0x7)<<8)+ MEM[0xFF13]);
      sound[1].freq(  131072/(2048-  sound[1].freqnum  )  )
      if (data&(1<<7)) {
        sound[1].initialized = true
        sound[1].env = MEM[0xFF12]>>4; // default envelope value
        sound[1].envCounter = 0;
        sound[1].amp( sound[1].env/15 )

        sound[1].lengthEnabled = (data&(1<<6)) !=0;
        sound[1].length = (64-(MEM[0xFF11]&0x3F));

        MEM[0xFF26] |= (1<<0) // flag sound 1 as on
        //if (sound[1].sweepShift) {sweepCalculate()}
      }
      MEM[addr] = data
      return;
    }


    // FF16 - NR21 - Channel 2 Sound Length/Wave Pattern Duty (R/W)
        // Bit 7-6 - Wave Pattern Duty (Read/Write)
        // Bit 5-0 - Sound length data (Write Only) (t1: 0-63)
    if (addr == 0xFF16) {
      MEM[addr] = data
      sound[2].duty(data>>6)
      return;
    }

    // FF17 - NR22 - Channel 2 Volume Envelope (R/W)
    if (addr == 0xFF17) {
      MEM[addr] = data
      sound[2].envDirection = (data&(1<<3)) ? 1: -1;
      sound[2].envSpeed = data&0x7;
      sound[2].envCounter = 0;
      return;
    }
    // FF18 - NR23 - Channel 2 Frequency lo data (W)
    if (addr == 0xFF18) {
      sound[2].freq(  131072/(2048-  (((MEM[0xFF19]&0x7)<<8)+ data)  )  )
      MEM[addr] = data
      return;
    }
    // FF19 - NR24 - Channel 2 Frequency hi data (R/W)
    if (addr == 0xFF19) {
      sound[2].freq(  131072/(2048-  (((data&0x7)<<8)+ MEM[0xFF18])  )  )
      //bit 7 is initialize
      if (data&(1<<7)) {
        sound[2].initialized = true
        sound[2].env = MEM[0xFF17]>>4; //Default envelope value
        sound[2].envCounter = 0;
        sound[2].amp( sound[2].env/15 )

        sound[2].lengthEnabled = (data&(1<<6)) !=0;
        sound[2].length = (64-(MEM[0xFF16]&0x3F));
        MEM[0xFF26] |= (1<<1) // flag sound 2 as on
      }
      MEM[addr] = data
      return;
    }

    // Sound 3 - user-defined waveform
    // "it can output a sound while changing its length, frequency, and level"
    // not sure what changing its length means

    // FF1A - NR30 - Channel 3 Sound on/off (R/W)
    if (addr==0xFF1A) {
      if (data&(1<<7)) {
        sound[3].initialized=true;

        // is this the right (only?) place to load the waveform?
        setSound3Waveform()

      } else {
        sound[3].initialized=false;
        sound[3].amp(0)
      }
      return;
    }
    // FF1B - NR31 - Channel 3 Sound Length
    if (addr==0xFF1B) {
      MEM[addr] = data
      return;
    }
    // FF1C - NR32 - Channel 3 Select output level (R/W)
    if (addr==0xFF1C) {
      // Really we ought to bit-crush it, but whatever
      if (sound[3].initialized) sound[3].amp( [ 0,0.5,0.25,0.125 ][((data>>5)&0x3)] )
      MEM[addr] = data
      return;
    }

    // FF1D - NR33 - Channel 3 Frequency's lower data (W)
    if (addr == 0xFF1D) {
      sound[3].freq(   65536/(2048-  (((MEM[0xFF1E]&0x7)<<8)+ data)  )  )
      MEM[addr] = data
      return;
    }
    // FF1E - NR34 - Channel 3 Frequency's higher data (R/W)
    if (addr == 0xFF1E) {
      sound[3].freq(   65536/(2048-  (((data&0x7)<<8)+ MEM[0xFF1D])  )  )
      //bit 7 is initialize
      if (data&(1<<7)) {

        sound[3].initialized = true

        sound[3].amp( [ 0,0.5,0.25,0.15 ][((MEM[0xFF1C]>>5)&0x3)] )

        sound[3].lengthEnabled = (data&(1<<6)) !=0;
        sound[3].length = (256-MEM[0xFF1B]);

        MEM[0xFF26] |= (1<<2) // flag sound 3 as on
      }
      MEM[addr] = data
      return;
    }

    // Sound 4 - Noise
    // FF20 - NR41 - Channel 4 Sound Length (R/W)
    if (addr==0xFF20) {
      MEM[addr] = data
      return;
    }
    // FF21 - NR42 - Channel 4 Volume Envelope (R/W)
    if (addr==0xFF21) {
      MEM[addr] = data
      sound[4].envDirection = (data&(1<<3)) ? 1: -1;
      sound[4].envSpeed = data&0x7;
      sound[4].envCounter = 0;
      return;
    }
    // FF22 - NR43 - Channel 4 Polynomial Counter (R/W)
    if (addr==0xFF22) {
      sound[4].freq(data>>4, data&0x7)
      sound[4].polySteps(data&(1<<3))

      MEM[addr] = data
      return;
    }
    // FF23 - NR44 - Channel 4 Counter/consecutive; Inital (R/W)
    if (addr==0xFF23) {

      sound[4].initialized = true
      sound[4].env = MEM[0xFF21]>>4; //Default envelope value
      sound[4].envCounter = 0;
      sound[4].amp( sound[4].env/15 )
      sound[4].length = (64-(MEM[0xFF20]&0x3F));
      
      MEM[0xFF26] |= (1<<3) // flag sound 4 as on

      sound[4].lengthEnabled = (data&(1<<6)) !=0;
      MEM[addr] = data; 
      return
    }


    // FF24 - NR50 - Channel control / ON-OFF / Volume (R/W)
    if (addr == 0xFF24) {
       //  Bit 7   - Output Vin to SO2 terminal (1=Enable)
       //  Bit 6-4 - SO2 output level (volume)  (0-7)
       //  Bit 3   - Output Vin to SO1 terminal (1=Enable)
       //  Bit 2-0 - SO1 output level (volume)  (0-7)

      // is level zero mute ? "minimum level"
      sound.SO2.gain.setValueAtTime(((data>>4)&0x7)/7, audioCtx.currentTime)
      sound.SO1.gain.setValueAtTime((data&0x7)/7,      audioCtx.currentTime)
      MEM[addr] = data; 
      return
    }

    // FF25 - NR51 - Selection of Sound output terminal (R/W)
    if (addr == 0xff25) {

      var con = (MEM[0xff25]^data) & data;
      var dis = (MEM[0xff25]^data) & (~data);

      for (var i=0;i<4;i++) {
        if (con&(1<<i))
          sound[i+1].gainNode.connect(sound.SO1)
        if (dis&(1<<i))
          sound[i+1].gainNode.disconnect(sound.SO1)
        if (con&(1<<(4+i)))
          sound[i+1].gainNode.connect(sound.SO2)
        if (dis&(1<<(4+i)))
          sound[i+1].gainNode.disconnect(sound.SO2)
      }

      MEM[addr] = data; 
      return
    }

    return;
  }
  if (addr>=0xFF30 && addr<=0xFF3F) sound[3].waveChanged=true;

  //LCD control
  if (addr==0xFF40) {
    var cc = data&(1<<7);
    if (LCD_enabled !=cc) {
      LCD_enabled=!!cc;
      if (!LCD_enabled){ // Disabling the display sets it to mode 1
        // this should also probably set all pixels to white
        LCD_scan=0;
        MEM[0xFF41] = (MEM[0xFF41] & 0xFC) +1;
      }
    }
  }
  if (addr==0xFF41) {
    //don't overwrite the lowest two bits (mode)
    MEM[0xFF41] &= 0x3
    data &= 0xFC
    MEM[0xFF41] |= 0x80|data; // BGB has highest bit always set
    return;
  }

  // LY - write causes reset
  if (addr==0xFF44) { MEM[0xFF44] = 0; return }

  // FF46 - DMA - DMA Transfer and Start Address (W)
  if (addr==0xFF46) {
    var st=data<<8;
    for (var i=0;i<=0x9F;i++) 
      MEM[0xFE00 +i] = readMem(st + i);
    return
  }

  // disable bootrom
  if (addr==0xFF50) { for (var i=0;i<256;i++) ROM[i]=FirstROMPage[i]; return}

  MEM[addr] = data;
}
function writeMem16(addr, dataH, dataL){
  writeMem(addr, dataL)
  writeMem(addr+1, dataH)
}

function doMBC(addr, data){

  switch (ROM[0x147]) {

  // Cartridge Type = ROM[0x147]

  case 0: // ROM ONLY
    // do any type 0 carts have switchable ram?
  break;

  case 0x01: //  MBC1
  case 0x02: //  MBC1+RAM
  case 0x03: //  MBC1+RAM+BATTERY
    if (addr <= 0x1FFF) {
      RAMenabled = ((data & 0x0F) == 0xA) 
    } else if (addr <= 0x3FFF){
      data &= 0x1F;
      if (data==0) data=1 // MBC1 translates bank 0 to bank 1 (apparently regardless of upper bits)
      // set lowest 5 bits of bank number
      ROMbank = (ROMbank&0xE0)|(data&0x1F);
      ROMbankoffset = (ROMbank-1)*0x4000 %ROM.length;
    } else if (addr<=0x5fff) {
      data &= 0x3
      if (MBCRamMode==0) {
        ROMbank = (ROMbank&0x1F)|(data<<5);
        ROMbankoffset = (ROMbank-1)*0x4000  %ROM.length;
      } else {
        RAMbank=data;
        RAMbankoffset = RAMbank*0x2000 - 0xA000
      }
    } else {
      MBCRamMode = data&1;
      if (MBCRamMode==0) {
        RAMbank=0;
        RAMbankoffset = RAMbank*0x2000 - 0xA000
      } else {
        ROMbank &=0x1F;
        ROMbankoffset = (ROMbank-1)*0x4000  %ROM.length;
      }
    }
    
  break;

  case 0x05: //  MBC2
  case 0x06: //  MBC2+BATTERY
    
    if (addr <= 0x1FFF) {
      if ((addr&0x0100) ==0)
        RAMenabled = ((data & 0x0F) == 0xA) 
    } else if (addr <= 0x3FFF){
      data &=0x0F;
      if (data==0) data=1
      ROMbank = data;
      ROMbankoffset = (ROMbank-1)*0x4000 %ROM.length;
    }

  break;

  // case 0x08: //  ROM+RAM
  // case 0x09: //  ROM+RAM+BATTERY
  // case 0x0B: //  MMM01
  // case 0x0C: //  MMM01+RAM
  // case 0x0D: //  MMM01+RAM+BATTERY
  // case 0x0F: //  MBC3+TIMER+BATTERY
  // case 0x10: //  MBC3+TIMER+RAM+BATTERY
  case 0x11: //  MBC3
  case 0x12: //  MBC3+RAM
  case 0x13: //  MBC3+RAM+BATTERY

    if (addr <= 0x1FFF) {
      RAMenabled = ((data & 0x0F) == 0xA) 
    } else if (addr <= 0x3FFF){
      if (data==0) data=1 // allows access to banks 0x20, 0x40, 0x60
      ROMbank = data&0x7F;
      ROMbankoffset = (ROMbank-1)*0x4000 %ROM.length;
    } else if (addr<=0x5fff) {
      if (data < 8) {
        RAMbank=data;
        RAMbankoffset = RAMbank*0x2000 - 0xA000
      } else{
        // RTC registers here
      }
    } else {
      // RTC latch
    }
  break;

  case 0x19: //  MBC5
  case 0x1A: //  MBC5+RAM
  case 0x1B: //  MBC5+RAM+BATTERY
  // case 0x1C: //  MBC5+RUMBLE
  // case 0x1D: //  MBC5+RUMBLE+RAM
  // case 0x1E: //  MBC5+RUMBLE+RAM+BATTERY
    if (addr <= 0x1FFF) {
      RAMenabled = ((data & 0x0F) == 0xA) 
    } else if (addr <= 0x2FFF){
      // Allows access to bank 0
      ROMbank &= 0x100;
      ROMbank |= data;
      ROMbankoffset = (ROMbank-1)*0x4000;
      while (ROMbankoffset>ROM.length) ROMbankoffset-=ROM.length;
    } else if (addr <= 0x3FFF){
      ROMbank &= 0xFF;
      if (data&1) ROMbank+=0x100;
      ROMbankoffset = (ROMbank-1)*0x4000;
      while (ROMbankoffset>ROM.length) ROMbankoffset-=ROM.length;
    } else if (addr<=0x5fff) {
      RAMbank=data&0x0F;
      RAMbankoffset = RAMbank*0x2000 - 0xA000
    }
  break;

  // case 0x20: //  MBC6
  // case 0x22: //  MBC7+SENSOR+RUMBLE+RAM+BATTERY
  // case 0xFC: //  POCKET CAMERA
  // case 0xFD: //  BANDAI TAMA5
  // case 0xFE: //  HuC3
  // case 0xFF: //  HuC1+RAM+BATTERY

    default: throw Error("Unimplemented memory controller");

  }
}
function resetSoundRegisters(){
  
   MEM[0xFF10] = 0x80   // NR10
   MEM[0xFF11] = 0xBF   // NR11
   MEM[0xFF12] = 0xF3   // NR12
   MEM[0xFF13] = 0
   MEM[0xFF14] = 0xBF   // NR14
   MEM[0xFF15] = 0xFF // NA
   MEM[0xFF16] = 0x3F   // NR21
   MEM[0xFF17] = 0x00   // NR22
   MEM[0xFF18] = 0
   MEM[0xFF19] = 0xBF   // NR24
   MEM[0xFF1A] = 0x7F   // NR30
   MEM[0xFF1B] = 0xFF   // NR31
   MEM[0xFF1C] = 0x9F   // NR32
   MEM[0xFF1D] = 0
   MEM[0xFF1E] = 0xBF   // NR33
   MEM[0xFF1F] = 0xFF // NA
   MEM[0xFF20] = 0xFF   // NR41
   MEM[0xFF21] = 0x00   // NR42
   MEM[0xFF22] = 0x00   // NR43
   MEM[0xFF23] = 0xBF   // NR30
   MEM[0xFF24] = 0x77   // NR50
   writeMem(0xFF25,0xF3)  // NR51
   MEM[0xFF26] = 0xF1   // NR52

}




var REG = new Uint8Array(8);

var FLAGS = {
  Z:false,
  N:false,
  H:false,
  C:false
}

var PC = 0

var SP = 0

var IME = false // Interrupt master enable
var cpu_halted=false;


const A = 0b111
const B = 0b000
const C = 0b001
const D = 0b010
const E = 0b011
const H = 0b100
const L = 0b101

const HL = 0b110

const Immediate = 257
const BC = 258
const DE = 259
const SPr = 260

const opcodes = Array(256);
for (var i=0;i<256;i++) opcodes[i]=function(){ throw Error("Undefined Opcode" )};

const CBcodes = Array(256);
for (var i=0;i<256;i++) CBcodes[i]=function(){ throw Error("Undefined 0xCB Opcode" )};


function ld(a,b){ 

  if (b==Immediate) return function(){
    REG[a] = readMem( PC+1 );
    PC+=2
    return 8;
  }

  return function(){
    REG[a] = REG[b];
    PC++
    return 4;
  }
}
function ld_from_mem(a, b, c){
  if (b==Immediate) return function(){
    REG[a] = readMem( readMem( PC+1 ) + (readMem( PC+2 ) <<8) );
    PC+=3;
    return 16;
  }

  return function(){
    REG[a] = readMem( (REG[b]<<8)+REG[c] );
    PC++;
    return 8;
  }
}

function ld_to_mem(a, b, c){
  if (a==Immediate) return function(){
    writeMem( readMem( PC+1 ) + (readMem( PC+2 ) <<8), REG[b] )
    PC+=3
    return 16;
  }
  if (c==Immediate) return function(){
    writeMem( (REG[a]<<8)+REG[b] , readMem(PC+1) );
    PC+=2
    return 12
  }
  return function(){
    writeMem( (REG[a]<<8)+REG[b] , REG[c] );
    PC++
    return 8
  }
}

// Messy...
function ld16(a,b,c){
  if (b==Immediate) {
    if (a==HL) return function(){
      // mem to hl
      var s = readMem16(readMem( PC+1 ) + (readMem( PC+2 )<<8));

      REG[H] = s[0]
      REG[L] = s[1]

      PC+=3
      return 12
    }

    // immediate into SP... 
    return function(){
      SP = readMem( PC+1 ) + (readMem( PC+2 ) <<8)
      PC+=3
      return 12
    }

  }
  if (c==Immediate) return function(){
    
    REG[a] = readMem( PC+2 )
    REG[b] = readMem( PC+1 )

    PC+=3
    return 12
  }

  // ld sp, hl
  return function(){
    SP = (REG[H]<<8) + REG[L]
    PC++
    return 8
  }
}

function ldd(a,b){ //load with decrement
  if (a==HL) return function(){
    writeMem( (REG[H]<<8)+REG[L] , REG[A] );

    if (REG[L]==0) REG[H]--;
    REG[L]--;
    
    PC++
    return 8
  }

  return function(){
    REG[A] = readMem( (REG[H]<<8)+REG[L] );

    if (REG[L]==0) REG[H]--;
    REG[L]--;

    PC++
    return 8
  }

}
function ldi(a,b){ //load with increment
  if (a==HL) return function(){
    writeMem( (REG[H]<<8)+REG[L] , REG[A] );
    
    if (REG[L]==255) REG[H]++;
    REG[L]++;
    
    PC++
    return 8
  }

  return function(){
    REG[A] = readMem( (REG[H]<<8)+REG[L] );

    if (REG[L]==255) REG[H]++;
    REG[L]++;

    PC++
    return 8
  }

}

function ldc(a,b){
  if (a==A) return function(){ //LD   A, (FF00+C)
    REG[A] = readMem( 0xFF00 + REG[C] )
    PC++
    return 8
  }
  return function(){ //LD   (FF00+C),A
    writeMem(0xFF00 + REG[C], REG[A])
    PC++
    return 8
  }
}
function ldh(a,b){
  if (a==A) return function(){ //LD   A, (FF00+n)
    REG[A] = readMem( 0xFF00 + readMem(PC+1) )
    PC+=2
    return 12
  }
  return function(){ //LD   (FF00+n),A
    writeMem(0xFF00 + readMem(PC+1), REG[A])
    PC+=2
    return 12
  }
}


function ALU(op, a, b){

  if (b == Immediate) return function(){
    REG[A] = ALU_process_8bit( op, readMem( PC+1 ) )
    PC+=2
    return 8
  }
  if (b == HL) return function(){
    REG[A] = ALU_process_8bit( op, readMem( (REG[H]<<8)+REG[L] ) );
    PC++
    return 8
  }
  return function(){
    REG[A] = ALU_process_8bit( op, REG[b]);
    PC++
    return 4
  }
}

const ADD = 1
const ADC = 2
const SUB = 3
const SBC = 4
const AND = 5
const OR  = 6
const XOR = 7
const CP  = 8


function ALU_process_8bit(op, b){

  var result = REG[A];
  FLAGS.N = false;

  switch (op){
    case ADD: 
      FLAGS.H = !!(((REG[A]&0x0F) + (b&0x0F)) & 0x10)
      result += b;
    break;
    case ADC:
      FLAGS.H = !!(((REG[A]&0x0F) + (b&0x0F) + FLAGS.C) & 0x10)
      result += b + FLAGS.C;
    break;
    case SUB: 
      result -= b;
      FLAGS.N = true;
      FLAGS.H = !!(((REG[A]&0x0F) - (b&0x0F)) & 0x10)
    break;

    case CP:
      result -= b;
      FLAGS.N = true;
      FLAGS.H = !!(((REG[A]&0x0F) - (b&0x0F)) & 0x10)
      FLAGS.Z = ((result & 0xff) == 0)
      FLAGS.C = result > 255 || result < 0;
    return REG[A];

    case SBC:
      result -= b + FLAGS.C;
      FLAGS.N = true;
      FLAGS.H = !!(((REG[A]&0x0F) - (b&0x0F) - FLAGS.C) & 0x10)
    break;
    case AND:
      result &= b;
      FLAGS.H = true
    break;
    case OR:
      result |= b;
      FLAGS.H = false
    break;
    case XOR: 
      result ^= b;
      FLAGS.H = false
    break;

  }

  FLAGS.Z = ((result&0xff) == 0)
  FLAGS.C = result > 255 || result < 0;

  return result&0xFF;
}

function inc(a){return incdec(a, 1)}
function dec(a){return incdec(a, -1)}

function incdec(r,offset) {
  if (r==HL) return function(){
    writeMem((REG[H]<<8)+REG[L], incdec_process_8bit( readMem( (REG[H]<<8)+REG[L] ) ,offset))
    PC++
    return 12
  }

  return function(){
    REG[r]=incdec_process_8bit(REG[r],offset)
    PC++
    return 4
  }
}

function incdec_process_8bit(a,offset) {
    var result = a+offset;
    FLAGS.H = !!(((a&0x0F) +offset) & 0x10)
    FLAGS.N = offset == -1
    FLAGS.Z = ((result & 0xff) == 0)
    return result;
}

// 16 bit inc / dec affect no flags
function inc16(a,b) {
  if (a==SPr) return function(){
    SP++
    PC++
    return 8
  }
  return function(){
    if (REG[b] ==255) REG[a]++;
    REG[b]++;
    PC++;
    return 8
  }
}
function dec16(a,b) {
  if (a==SPr) return function(){
    SP--
    PC++
    return 8
  }
  return function(){
    if (REG[b] ==0) REG[a]--;
    REG[b]--;
    PC++;
    return 8
  }
}

function signedOffset(b){
  return (b>127)? (b-256) : b;
}

function jrNZ(){
  if (FLAGS.Z) {PC+=2; return 8}
  PC += 2+signedOffset(readMem(PC+1))
  return 12
}

function jrNC(){
  if (FLAGS.C) {PC+=2; return 8}
  PC += 2+signedOffset(readMem(PC+1))
  return 12
}

function jrZ(){
  if (!FLAGS.Z) {PC+=2; return 8}
  PC += 2+signedOffset(readMem(PC+1));
  return 12
}

function jrC(){
  if (!FLAGS.C) {PC+=2; return 8}
  PC += 2+signedOffset(readMem(PC+1))
	return 12
}

function jr(){ //unconditional relative
  PC += 2+signedOffset(readMem(PC+1))
  return 12
}

function jp(){ //unconditional absolute
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 16
}
function jpNZ(){
  if (FLAGS.Z) {PC+=3; return 12}
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 16
}
function jpNC(){
  if (FLAGS.C) {PC+=3; return 12}
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 16
}
function jpZ(){
  if (!FLAGS.Z) {PC+=3; return 12}
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 16
}
function jpC(){
  if (!FLAGS.C) {PC+=3; return 12}
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 16
}

function jpHL(){
  PC = (REG[H]<<8)+REG[L]
  return 4
}

function push(a,b) {
  if (a==A) return function(){
    var flags = (FLAGS.Z << 7) + (FLAGS.N << 6) + (FLAGS.H << 5) + (FLAGS.C << 4)
    SP -=2
    writeMem16(SP, REG[A], flags)
    PC++
    return 16
  }
  return function(){
    SP-=2
    writeMem16(SP, REG[a], REG[b])
    PC++
    return 16
  }
}

function pop(a,b) {
  if (a==A) return function(){
    var s = readMem16(SP);
    REG[A] = s[0]
    FLAGS.Z = (s[1] & (1<<7)) != 0
    FLAGS.N = (s[1] & (1<<6)) != 0
    FLAGS.H = (s[1] & (1<<5)) != 0
    FLAGS.C = (s[1] & (1<<4)) != 0
    SP+=2
    PC++
    return 12
  }
  return function(){
    var s = readMem16(SP);
    REG[a] = s[0]
    REG[b] = s[1]
    SP+=2
    PC++
    return 12
  }
}

function call(){
  SP -=2
  var npc = PC+3
  writeMem16(SP, npc>>8, npc&0xFF)
  PC = readMem(PC+1)+(readMem(PC+2)<<8)
  return 24
}
function callNZ(){
  if (FLAGS.Z) {PC+=3; return 12}
  return call()
}
function callNC(){
  if (FLAGS.C) {PC+=3; return 12}
  return call()
}
function callZ(){
  if (!FLAGS.Z) {PC+=3; return 12}
  return call()
}
function callC(){
  if (!FLAGS.C) {PC+=3; return 12}
  return call()
}

function ret(){
  var s = readMem16(SP);
  SP+=2
  PC = (s[0]<<8)+s[1]
  return 16
}
function retNZ(){
  if (FLAGS.Z) {PC++; return 8}
  ret()
  return 20
}
function retNC(){
  if (FLAGS.C) {PC++; return 8}
  ret()
  return 20
}
function retZ(){
  if (!FLAGS.Z) {PC++; return 8}
  ret()
  return 20
}
function retC(){
  if (!FLAGS.C) {PC++; return 8}
  ret()
  return 20
}
function reti(){
  IME = true
  return ret()
}

function ei(){
  // This needs to wait until the end of the next instruction
  IME = true
  PC++
  return 4
}

function di(){
  IME = false
  PC++
  return 4
}

function rst(a){
  return function(){
    SP -=2
    var npc = PC+1 // datasheets say to push the current program counter, but surely it means the return address
    writeMem16(SP, npc>>8, npc&0xFF)
    PC = a
    return 16
  }
}

const RLC = 1
const RRC = 2
const RL  = 3
const RR  = 4
const SLA = 5
const SRA = 6
const SRL = 7

function shift_fast(op, a){
  return function(){
    REG[a] = shift_process(op, REG[a])
    FLAGS.Z=false // Bizarre, but correct
    PC++
    return 4
  }
}

function shift(op, a){
  if (a==HL) return function(){
    var addr= (REG[H]<<8)+REG[L];
    writeMem( addr , shift_process( op, readMem(addr) ) )
    PC++
    return 16
  }
  return function(){
    REG[a] = shift_process(op, REG[a])
    PC++
    return 8
  }
}

function shift_process(op, a){

  var bit7 = a>>7, bit0 = a&1;

  switch (op) {
    case RLC: // Rotate byte left, save carry
      a = ((a<<1)&0xff) + bit7
      FLAGS.C = !!bit7
    break;
    case RRC: // Rotate byte right, save carry
      a = ((a>>1)&0xff) + (bit0<<7)
      FLAGS.C = !!bit0
    break;
    case RL : //Rotate left through carry
      a = ((a<<1)&0xff) + FLAGS.C 
      FLAGS.C = !!bit7
    break;
    case RR : //Rotate right through carry
      a = ((a>>1)&0xff) + (FLAGS.C<<7)
      FLAGS.C = !!bit0
    break;
    case SLA: //Shift left
      a = ((a<<1)&0xff)
      FLAGS.C = !!bit7
    break;
    case SRA: //Shift right arithmetic
      a = ((a>>1)&0xff) + (bit7<<7)
      FLAGS.C = !!bit0
    break;
    case SRL: //Shift right logical
      a = ((a>>1)&0xff)
      FLAGS.C = !!bit0
    break;
  }

  FLAGS.N=false
  FLAGS.H=false
  FLAGS.Z= (a&0xFF)==0
  return a
}

function ccf(){
  FLAGS.N =false
  FLAGS.H =false
  FLAGS.C =!FLAGS.C
  PC++
  return 4
}
function scf(){
  FLAGS.N =false
  FLAGS.H =false
  FLAGS.C =true
  PC++
  return 4
}
function cpl(){
  REG[A] = ~REG[A]
  FLAGS.N =true
  FLAGS.H =true
  PC++
  return 4
}
function addHL(a,b){
  if (a==SPr) return function(){
    var c = (REG[L] += (SP&0xFF))>255?1:0;
    var h = REG[H] + (SP>>8) + c
    FLAGS.H = !!(((REG[H]&0x0F) + ((SP>>8)&0x0F) + c) & 0x10)
    REG[H] = h;
    FLAGS.C = (h>255)
    FLAGS.N=false
    PC++
    return 8
  }
  return function(){
    var c = (REG[L]+= REG[b])>255?1:0;
    var h = REG[H] + REG[a] + c
    FLAGS.H = !!(((REG[H]&0x0F) + (REG[a]&0x0F) + c) & 0x10)
    REG[H] = h;
    FLAGS.C = (h>255)
    FLAGS.N=false
    PC++
    return 8
  }
}
function daa(){
//http://gbdev.gg8.se/wiki/articles/DAA

  if (FLAGS.N) {
    if (FLAGS.C) REG[A]-=0x60;
    if (FLAGS.H) REG[A]-=0x06;
  } else {
    if (       REG[A]>0x99 || FLAGS.C) {REG[A]+=0x60; FLAGS.C=true}
    if ((REG[A]&0x0f)>0x09 || FLAGS.H) REG[A]+=0x06;
  }

  FLAGS.Z = REG[A] == 0
  FLAGS.H = false

  PC++
  return 4
}
function ld_imm_sp(){
  writeMem16( readMem(PC+1)+(readMem(PC+2)<<8) , SP>>8, SP&0xFF );
  PC+=3
  return 20
}
function ld_hl_spdd(){
  var b = signedOffset(readMem(PC+1));

  FLAGS.H= !!(((SP&0x0F) + (b&0x0F)) &0x010)
  FLAGS.C= !!(((SP&0xFF) + (b&0xFF)) &0x100)

  var n = SP + b
  REG[H] =(n>>8)
  REG[L] =n&0xFF

  FLAGS.N=false
  FLAGS.Z=false
  PC+=2
  return 12
}
function add_sp_n(){
  var b=signedOffset(readMem(PC+1))

  FLAGS.H= !!(((SP&0x0F) + (b&0x0F)) &0x010)
  FLAGS.C= !!(((SP&0xFF) + (b&0xFF)) &0x100)

  SP += b
  FLAGS.N=false
  FLAGS.Z=false

  SP&=0xFFFF
  PC+=2
  return 16
}

function halt() {
// if interrupts disabled, stall 1 cycle, skip next instruction and continue
  cpu_halted=true;
  PC++;
  return 4
}; 
function stop(){
  //TODO
  PC+=2;
  return 4
}

const unused = function(){ return 4 }; //GMB locks when called

opcodes[ 0x00 ] = function nop(){ PC++; return 4 };
opcodes[ 0x01 ] = ld16(B,C,Immediate);
opcodes[ 0x02 ] = ld_to_mem(B,C,A);
opcodes[ 0x03 ] = inc16(B,C);
opcodes[ 0x04 ] = inc(B);
opcodes[ 0x05 ] = dec(B);
opcodes[ 0x06 ] = ld(B, Immediate);
opcodes[ 0x07 ] = shift_fast(RLC, A) //rlca
opcodes[ 0x08 ] = ld_imm_sp; //LD   (nn),SP
opcodes[ 0x09 ] = addHL(B,C);
opcodes[ 0x0A ] = ld_from_mem(A, B, C);
opcodes[ 0x0B ] = dec16(B,C);
opcodes[ 0x0C ] = inc(C);
opcodes[ 0x0D ] = dec(C);
opcodes[ 0x0E ] = ld(C, Immediate);
opcodes[ 0x0F ] = shift_fast(RRC, A);


opcodes[ 0x10 ] = stop;
opcodes[ 0x11 ] = ld16(D,E,Immediate);
opcodes[ 0x12 ] = ld_to_mem(D,E,A);
opcodes[ 0x13 ] = inc16(D,E);
opcodes[ 0x14 ] = inc(D);
opcodes[ 0x15 ] = dec(D);
opcodes[ 0x16 ] = ld(D, Immediate);
opcodes[ 0x17 ] = shift_fast(RL, A) 
opcodes[ 0x18 ] = jr;
opcodes[ 0x19 ] = addHL(D,E); //ADD HL, DE
opcodes[ 0x1A ] = ld_from_mem(A, D, E);
opcodes[ 0x1B ] = dec16(D,E);
opcodes[ 0x1C ] = inc(E);
opcodes[ 0x1D ] = dec(E);
opcodes[ 0x1E ] = ld(E, Immediate);
opcodes[ 0x1F ] = shift_fast(RR, A);

opcodes[ 0x20 ] = jrNZ;
opcodes[ 0x21 ] = ld16(H,L,Immediate);
opcodes[ 0x22 ] = ldi(HL,A);
opcodes[ 0x23 ] = inc16(H,L);
opcodes[ 0x24 ] = inc(H);
opcodes[ 0x25 ] = dec(H);
opcodes[ 0x26 ] = ld(H, Immediate);
opcodes[ 0x27 ] = daa;
opcodes[ 0x28 ] = jrZ;
opcodes[ 0x29 ] = addHL(H,L);
opcodes[ 0x2A ] = ldi(A,HL);
opcodes[ 0x2B ] = dec16(H,L);
opcodes[ 0x2C ] = inc(L);
opcodes[ 0x2D ] = dec(L);
opcodes[ 0x2E ] = ld(L, Immediate);
opcodes[ 0x2F ] = cpl;

opcodes[ 0x30 ] = jrNC;
opcodes[ 0x31 ] = ld16(SPr, Immediate);
opcodes[ 0x32 ] = ldd(HL,A);
opcodes[ 0x33 ] = inc16(SPr);
opcodes[ 0x34 ] = inc(HL);
opcodes[ 0x35 ] = dec(HL);
opcodes[ 0x36 ] = ld_to_mem(H,L,Immediate);
opcodes[ 0x37 ] = scf;
opcodes[ 0x38 ] = jrC;
opcodes[ 0x39 ] = addHL(SPr);
opcodes[ 0x3A ] = ldd(A,HL);
opcodes[ 0x3B ] = dec16(SPr);
opcodes[ 0x3C ] = inc(A);
opcodes[ 0x3D ] = dec(A);
opcodes[ 0x3E ] = ld(A, Immediate);
opcodes[ 0x3F ] = ccf;


opcodes[ 0x40 ] = ld(B,B);
opcodes[ 0x41 ] = ld(B,C);
opcodes[ 0x42 ] = ld(B,D);
opcodes[ 0x43 ] = ld(B,E);
opcodes[ 0x44 ] = ld(B,H);
opcodes[ 0x45 ] = ld(B,L);
opcodes[ 0x46 ] = ld_from_mem(B, H, L );
opcodes[ 0x47 ] = ld(B,A);

opcodes[ 0x48 ] = ld(C,B);
opcodes[ 0x49 ] = ld(C,C);
opcodes[ 0x4A ] = ld(C,D);
opcodes[ 0x4B ] = ld(C,E);
opcodes[ 0x4C ] = ld(C,H);
opcodes[ 0x4D ] = ld(C,L);
opcodes[ 0x4E ] = ld_from_mem(C, H, L );
opcodes[ 0x4F ] = ld(C,A);

opcodes[ 0x50 ] = ld(D,B);
opcodes[ 0x51 ] = ld(D,C);
opcodes[ 0x52 ] = ld(D,D);
opcodes[ 0x53 ] = ld(D,E);
opcodes[ 0x54 ] = ld(D,H);
opcodes[ 0x55 ] = ld(D,L);
opcodes[ 0x56 ] = ld_from_mem(D, H, L );
opcodes[ 0x57 ] = ld(D,A);

opcodes[ 0x58 ] = ld(E,B);
opcodes[ 0x59 ] = ld(E,C);
opcodes[ 0x5A ] = ld(E,D);
opcodes[ 0x5B ] = ld(E,E);
opcodes[ 0x5C ] = ld(E,H);
opcodes[ 0x5D ] = ld(E,L);
opcodes[ 0x5E ] = ld_from_mem(E, H, L );
opcodes[ 0x5F ] = ld(E,A);

opcodes[ 0x60 ] = ld(H,B);
opcodes[ 0x61 ] = ld(H,C);
opcodes[ 0x62 ] = ld(H,D);
opcodes[ 0x63 ] = ld(H,E);
opcodes[ 0x64 ] = ld(H,H);
opcodes[ 0x65 ] = ld(H,L);
opcodes[ 0x66 ] = ld_from_mem(H, H, L );
opcodes[ 0x67 ] = ld(H,A);

opcodes[ 0x68 ] = ld(L,B);
opcodes[ 0x69 ] = ld(L,C);
opcodes[ 0x6A ] = ld(L,D);
opcodes[ 0x6B ] = ld(L,E);
opcodes[ 0x6C ] = ld(L,H);
opcodes[ 0x6D ] = ld(L,L);
opcodes[ 0x6E ] = ld_from_mem(L, H, L );
opcodes[ 0x6F ] = ld(L,A);

opcodes[ 0x70 ] = ld_to_mem(H,L, B);
opcodes[ 0x71 ] = ld_to_mem(H,L, C);
opcodes[ 0x72 ] = ld_to_mem(H,L, D);
opcodes[ 0x73 ] = ld_to_mem(H,L, E);
opcodes[ 0x74 ] = ld_to_mem(H,L, H);
opcodes[ 0x75 ] = ld_to_mem(H,L, L);
opcodes[ 0x76 ] = halt;
opcodes[ 0x77 ] = ld_to_mem(H,L, A);

opcodes[ 0x78 ] = ld(A,B);
opcodes[ 0x79 ] = ld(A,C);
opcodes[ 0x7A ] = ld(A,D);
opcodes[ 0x7B ] = ld(A,E);
opcodes[ 0x7C ] = ld(A,H);
opcodes[ 0x7D ] = ld(A,L);
opcodes[ 0x7E ] = ld_from_mem(A, H, L );
opcodes[ 0x7F ] = ld(A,A);

opcodes[ 0x80 ] = ALU(ADD,A,B);
opcodes[ 0x81 ] = ALU(ADD,A,C);
opcodes[ 0x82 ] = ALU(ADD,A,D);
opcodes[ 0x83 ] = ALU(ADD,A,E);
opcodes[ 0x84 ] = ALU(ADD,A,H);
opcodes[ 0x85 ] = ALU(ADD,A,L);
opcodes[ 0x86 ] = ALU(ADD,A, HL );
opcodes[ 0x87 ] = ALU(ADD,A,A);

opcodes[ 0x88 ] = ALU(ADC,A,B);
opcodes[ 0x89 ] = ALU(ADC,A,C);
opcodes[ 0x8A ] = ALU(ADC,A,D);
opcodes[ 0x8B ] = ALU(ADC,A,E);
opcodes[ 0x8C ] = ALU(ADC,A,H);
opcodes[ 0x8D ] = ALU(ADC,A,L);
opcodes[ 0x8E ] = ALU(ADC,A, HL );
opcodes[ 0x8F ] = ALU(ADC,A,A);

opcodes[ 0x90 ] = ALU(SUB,A,B);
opcodes[ 0x91 ] = ALU(SUB,A,C);
opcodes[ 0x92 ] = ALU(SUB,A,D);
opcodes[ 0x93 ] = ALU(SUB,A,E);
opcodes[ 0x94 ] = ALU(SUB,A,H);
opcodes[ 0x95 ] = ALU(SUB,A,L);
opcodes[ 0x96 ] = ALU(SUB,A, HL );
opcodes[ 0x97 ] = ALU(SUB,A,A);

opcodes[ 0x98 ] = ALU(SBC,A,B);
opcodes[ 0x99 ] = ALU(SBC,A,C);
opcodes[ 0x9A ] = ALU(SBC,A,D);
opcodes[ 0x9B ] = ALU(SBC,A,E);
opcodes[ 0x9C ] = ALU(SBC,A,H);
opcodes[ 0x9D ] = ALU(SBC,A,L);
opcodes[ 0x9E ] = ALU(SBC,A, HL );
opcodes[ 0x9F ] = ALU(SBC,A,A);

opcodes[ 0xA0 ] = ALU(AND,A,B);
opcodes[ 0xA1 ] = ALU(AND,A,C);
opcodes[ 0xA2 ] = ALU(AND,A,D);
opcodes[ 0xA3 ] = ALU(AND,A,E);
opcodes[ 0xA4 ] = ALU(AND,A,H);
opcodes[ 0xA5 ] = ALU(AND,A,L);
opcodes[ 0xA6 ] = ALU(AND,A, HL );
opcodes[ 0xA7 ] = ALU(AND,A,A);

opcodes[ 0xA8 ] = ALU(XOR,A,B);
opcodes[ 0xA9 ] = ALU(XOR,A,C);
opcodes[ 0xAA ] = ALU(XOR,A,D);
opcodes[ 0xAB ] = ALU(XOR,A,E);
opcodes[ 0xAC ] = ALU(XOR,A,H);
opcodes[ 0xAD ] = ALU(XOR,A,L);
opcodes[ 0xAE ] = ALU(XOR,A, HL );
opcodes[ 0xAF ] = ALU(XOR,A,A);

opcodes[ 0xB0 ] = ALU(OR,A,B);
opcodes[ 0xB1 ] = ALU(OR,A,C);
opcodes[ 0xB2 ] = ALU(OR,A,D);
opcodes[ 0xB3 ] = ALU(OR,A,E);
opcodes[ 0xB4 ] = ALU(OR,A,H);
opcodes[ 0xB5 ] = ALU(OR,A,L);
opcodes[ 0xB6 ] = ALU(OR,A, HL );
opcodes[ 0xB7 ] = ALU(OR,A,A);

opcodes[ 0xB8 ] = ALU(CP,A,B);
opcodes[ 0xB9 ] = ALU(CP,A,C);
opcodes[ 0xBA ] = ALU(CP,A,D);
opcodes[ 0xBB ] = ALU(CP,A,E);
opcodes[ 0xBC ] = ALU(CP,A,H);
opcodes[ 0xBD ] = ALU(CP,A,L);
opcodes[ 0xBE ] = ALU(CP,A, HL );
opcodes[ 0xBF ] = ALU(CP,A,A);

opcodes[ 0xC0 ] = retNZ;
opcodes[ 0xC1 ] = pop(B,C);
opcodes[ 0xC2 ] = jpNZ;
opcodes[ 0xC3 ] = jp;
opcodes[ 0xC4 ] = callNZ;
opcodes[ 0xC5 ] = push(B,C);
opcodes[ 0xC6 ] = ALU(ADD,A,Immediate);
opcodes[ 0xC7 ] = rst(0x00);
opcodes[ 0xC8 ] = retZ;
opcodes[ 0xC9 ] = ret;
opcodes[ 0xCA ] = jpZ;
opcodes[ 0xCB ] = function(){ return CBcodes[ readMem( ++PC ) ](); }
opcodes[ 0xCC ] = callZ;
opcodes[ 0xCD ] = call;
opcodes[ 0xCE ] = ALU(ADC,A,Immediate);
opcodes[ 0xCF ] = rst(0x08);

opcodes[ 0xD0 ] = retNC;
opcodes[ 0xD1 ] = pop(D,E);
opcodes[ 0xD2 ] = jpNC;
opcodes[ 0xD3 ] = unused;
opcodes[ 0xD4 ] = callNC;
opcodes[ 0xD5 ] = push(D,E);
opcodes[ 0xD6 ] = ALU(SUB,A,Immediate);
opcodes[ 0xD7 ] = rst(0x10);
opcodes[ 0xD8 ] = retC;
opcodes[ 0xD9 ] = reti; //RETI
opcodes[ 0xDA ] = jpC;
opcodes[ 0xDB ] = unused;
opcodes[ 0xDC ] = callC;
opcodes[ 0xDD ] = unused;
opcodes[ 0xDE ] = ALU(SBC,A,Immediate);
opcodes[ 0xDF ] = rst(0x18);

opcodes[ 0xE0 ] = ldh(Immediate, A); //LD   (FF00+n),A
opcodes[ 0xE1 ] = pop(H,L);
opcodes[ 0xE2 ] = ldc(C, A); //LD   (FF00+C),A
opcodes[ 0xE3 ] = unused;
opcodes[ 0xE4 ] = unused;
opcodes[ 0xE5 ] = push(H,L);
opcodes[ 0xE6 ] = ALU(AND,A,Immediate);
opcodes[ 0xE7 ] = rst(0x20);
opcodes[ 0xE8 ] = add_sp_n; //ADD  SP,dd
opcodes[ 0xE9 ] = jpHL;
opcodes[ 0xEA ] = ld_to_mem(Immediate, A); //LD   (nn),A
opcodes[ 0xEB ] = unused;
opcodes[ 0xEC ] = unused;
opcodes[ 0xED ] = unused;
opcodes[ 0xEE ] = ALU(XOR,A,Immediate);
opcodes[ 0xEF ] = rst(0x28);

opcodes[ 0xF0 ] = ldh(A, Immediate); //LD   A,(FF00+n)
opcodes[ 0xF1 ] = pop(A,FLAGS);
opcodes[ 0xF2 ] =  ldc(A, C); //LD   A,(FF00+C)
opcodes[ 0xF3 ] = di;
opcodes[ 0xF4 ] = unused;
opcodes[ 0xF5 ] = push(A, FLAGS);
opcodes[ 0xF6 ] = ALU(OR,A,Immediate);
opcodes[ 0xF7 ] = rst(0x30);
opcodes[ 0xF8 ] = ld_hl_spdd; //LD   HL,SP+dd
opcodes[ 0xF9 ] = ld16();
opcodes[ 0xFA ] = ld_from_mem(A, Immediate); //LD   A,(nn)
opcodes[ 0xFB ] = ei;
opcodes[ 0xFC ] = unused;
opcodes[ 0xFD ] = unused;
opcodes[ 0xFE ] = ALU(CP,A,Immediate);
opcodes[ 0xFF ] = rst(0x38);




CBcodes[ 0x00 ] = shift(RLC, B);
CBcodes[ 0x01 ] = shift(RLC, C);
CBcodes[ 0x02 ] = shift(RLC, D);
CBcodes[ 0x03 ] = shift(RLC, E);
CBcodes[ 0x04 ] = shift(RLC, H);
CBcodes[ 0x05 ] = shift(RLC, L);
CBcodes[ 0x06 ] = shift(RLC, HL );
CBcodes[ 0x07 ] = shift(RLC, A);
CBcodes[ 0x08 ] = shift(RRC, B);
CBcodes[ 0x09 ] = shift(RRC, C);
CBcodes[ 0x0A ] = shift(RRC, D);
CBcodes[ 0x0B ] = shift(RRC, E);
CBcodes[ 0x0C ] = shift(RRC, H);
CBcodes[ 0x0D ] = shift(RRC, L);
CBcodes[ 0x0E ] = shift(RRC, HL );
CBcodes[ 0x0F ] = shift(RRC, A);

CBcodes[ 0x10 ] = shift(RL, B);
CBcodes[ 0x11 ] = shift(RL, C);
CBcodes[ 0x12 ] = shift(RL, D);
CBcodes[ 0x13 ] = shift(RL, E);
CBcodes[ 0x14 ] = shift(RL, H);
CBcodes[ 0x15 ] = shift(RL, L);
CBcodes[ 0x16 ] = shift(RL, HL );
CBcodes[ 0x17 ] = shift(RL, A);
CBcodes[ 0x18 ] = shift(RR, B);
CBcodes[ 0x19 ] = shift(RR, C);
CBcodes[ 0x1A ] = shift(RR, D);
CBcodes[ 0x1B ] = shift(RR, E);
CBcodes[ 0x1C ] = shift(RR, H);
CBcodes[ 0x1D ] = shift(RR, L);
CBcodes[ 0x1E ] = shift(RR, HL );
CBcodes[ 0x1F ] = shift(RR, A);

CBcodes[ 0x20 ] = shift(SLA, B);
CBcodes[ 0x21 ] = shift(SLA, C);
CBcodes[ 0x22 ] = shift(SLA, D);
CBcodes[ 0x23 ] = shift(SLA, E);
CBcodes[ 0x24 ] = shift(SLA, H);
CBcodes[ 0x25 ] = shift(SLA, L);
CBcodes[ 0x26 ] = shift(SLA, HL );
CBcodes[ 0x27 ] = shift(SLA, A);
CBcodes[ 0x28 ] = shift(SRA, B);
CBcodes[ 0x29 ] = shift(SRA, C);
CBcodes[ 0x2A ] = shift(SRA, D);
CBcodes[ 0x2B ] = shift(SRA, E);
CBcodes[ 0x2C ] = shift(SRA, H);
CBcodes[ 0x2D ] = shift(SRA, L);
CBcodes[ 0x2E ] = shift(SRA, HL );
CBcodes[ 0x2F ] = shift(SRA, A);

CBcodes[ 0x38 ] = shift(SRL, B);
CBcodes[ 0x39 ] = shift(SRL, C);
CBcodes[ 0x3A ] = shift(SRL, D);
CBcodes[ 0x3B ] = shift(SRL, E);
CBcodes[ 0x3C ] = shift(SRL, H);
CBcodes[ 0x3D ] = shift(SRL, L);
CBcodes[ 0x3E ] = shift(SRL, HL );
CBcodes[ 0x3F ] = shift(SRL, A);


function swap(r){
  if (r==HL) return function(){
    var a = readMem( (REG[H]<<8)+REG[L] );
    a = (a>>4) + ((a<<4)&0xFF);
    writeMem( (REG[H]<<8)+REG[L] , a ); 
    FLAGS.Z = (a==0)
    FLAGS.N =false
    FLAGS.H =false
    FLAGS.C =false
    PC++
    return 16
  }
  return function (){
    REG[r] = (REG[r]>>4) + ((REG[r]<<4)&0xFF)
    FLAGS.Z = (REG[r]==0)
    FLAGS.N =false
    FLAGS.H =false
    FLAGS.C =false
    PC++
    return 8
  }
}

CBcodes[ 0x30 ] = swap(B);
CBcodes[ 0x31 ] = swap(C);
CBcodes[ 0x32 ] = swap(D);
CBcodes[ 0x33 ] = swap(E);
CBcodes[ 0x34 ] = swap(H);
CBcodes[ 0x35 ] = swap(L);
CBcodes[ 0x36 ] = swap(HL);
CBcodes[ 0x37 ] = swap(A);

function bit(b, r) {
  b = (1<<b);

  if (r==HL) return function(){
    FLAGS.Z = ((readMem((REG[H]<<8)+REG[L]) & b) == 0)
    FLAGS.H = true;
    FLAGS.N = false;
    PC++
    return 12
  }
  return function(){
    FLAGS.Z = ((REG[r] & b) == 0)
    FLAGS.H = true;
    FLAGS.N = false;
    PC++
    return 8
  }
}
function set(b, r) {
  b = (1<<b);

  if (r==HL) return function(){
    writeMem(
      (REG[H]<<8)+REG[L],
      readMem((REG[H]<<8)+REG[L]) | b
    )
    PC++
    return 16
  }
  return function(){
    REG[r] |= b
    PC++
    return 8
  }
}
function res(b, r) {
  b = ~(1<<b);

  if (r==HL) return function(){
    writeMem(
      (REG[H]<<8)+REG[L],
      readMem((REG[H]<<8)+REG[L]) & b
    )
    PC++
    return 16
  }
  return function(){
    REG[r] &= b
    PC++
    return 8
  }
}

for (var i=0;i<8;i++){
  for (var j=0;j<8;j++) {
    CBcodes[ 0x40 + i*8 + j ] = bit(i, j);
    CBcodes[ 0x80 + i*8 + j ] = res(i, j);
    CBcodes[ 0xC0 + i*8 + j ] = set(i, j);
  }
}



var bootCode = "31 FE FF AF 21 FF 9F 32 CB 7C 20 FB 21 26 FF 0E 11 3E 80 32 E2 0C 3E F3 E2 32 3E 77 77 3E FC E0 47 11 A8 00 21 10 80 1A CD 95 00 CD 96 00 13 7B FE 34 20 F3 11 D8 00 06 08 1A 13 22 23 05 20 F9 3E 19 EA 10 99 21 2F 99 0E 0C 3D 28 08 32 0D 20 F9 2E 0F 18 F3 67 3E 64 57 E0 42 3E 91 E0 40 04 1E 02 0E 0C F0 44 FE 90 20 FA 0D 20 F7 1D 20 F2 0E 13 24 7C 1E 83 FE 62 28 06 1E C1 FE 64 20 06 7B E2 0C 3E 87 E2 F0 42 90 E0 42 15 20 D2 05 20 4F 16 20 18 CB 4F 06 04 C5 CB 11 17 C1 CB 11 17 05 20 F5 22 23 22 23 C9 00 00 00 0D 00 09 11 09 89 39 08 C9 00 0B 00 03 00 0C CC CC 00 0F 00 00 00 00 EC CC EC CC DD DD 99 99 98 89 EE FB 67 63 6E 0E CC DD 1F 9F 88 88 00 00 00 00 00 00 00 00 21 A8 00 11 A8 00 1A 13 BE 20 FE 23 7D FE 34 20 F5 06 19 78 86 23 05 20 FB 86 20 FE 3E 01 E0 50".split(" ").map(x => parseInt(x,16))



function sweepCalculate(){
  //If the result of this formula is a value consisting of more than 11 bits, sound output is stopped and the Sound 1 ON flag of NR52 (bit 0) is reset.
  //In a subtraction operation, if the subtrahend is less than 0, the result is the pre-calculation value X (t ) = X ( t - 1 ). However, if n = 0, shifting does not occur and the frequency is unchanged.

  if (sound[1].sweepDir) {
    sound[1].freqnum += (sound[1].freqnum >> sound[1].sweepShift);
    if (sound[1].freqnum>0x7ff) {
      sound[1].initialized=false;
      MEM[0xFF26] &= ~(1<<0) // flag sound 1 as off
      sound[1].amp(0)
    } else sound[1].freq( 131072/(2048-sound[1].freqnum) )
  } else {
    sound[1].freqnum -= (sound[1].freqnum >> sound[1].sweepShift);
    if (sound[1].freqnum<0) sound[1].freqnum += (sound[1].freqnum >> sound[1].sweepShift);
    sound[1].freq( 131072/(2048-sound[1].freqnum) )
  }
}


var soundPrescaler1=0, soundPrescaler2=0;
function soundStep(){ //256 times per second
  if (!SoundEnabled) return;

  // length resolution 1/256 second

  // Sound length = (64 - t1) x (1/256) sec

  if (sound[1].lengthEnabled) {
    if (--sound[1].length <=0) {
      sound[1].lengthEnabled=false;
      sound[1].initialized=false;
      sound[1].amp(0)
      MEM[0xFF26] &= ~(1<<0) // flag sound 1 as off
    }
  }
  if (sound[2].lengthEnabled) {
    if (--sound[2].length <=0) {
      sound[2].lengthEnabled=false;
      sound[2].initialized=false;
      sound[2].amp(0)
      MEM[0xFF26] &= ~(1<<1) // flag sound 2 as off
    }
  }
  if (sound[3].lengthEnabled) {
    if (--sound[3].length <=0) {
      sound[3].lengthEnabled=false;
      sound[3].initialized=false;
      sound[3].amp(0)
      MEM[0xFF26] &= ~(1<<2) // flag sound 3 as off
    }
  }
  if (sound[4].lengthEnabled) {
    if (--sound[4].length <=0) {
      sound[4].lengthEnabled=false;
      sound[4].initialized=false;
      sound[4].amp(0)
      MEM[0xFF26] &= ~(1<<3) // flag sound 4 as off
    }
  }


  if (soundPrescaler1++) {
    soundPrescaler1=0;
    // sweep resolution 1/128 second

    if (sound[1].initialized && sound[1].sweepTime ) {
      if (--sound[1].sweepPrescaler<0) {
        sound[1].sweepPrescaler += sound[1].sweepTime;
        sweepCalculate();
      }
    }

    if (soundPrescaler2++) {
      soundPrescaler2=0;
      // envelope resolution 1/64 second

      for (var i of [1,2,4]) {

        if (sound[i].initialized&&sound[i].envSpeed) {
          // counter is reset when speed changes
          if(++sound[i].envCounter == sound[i].envSpeed) {
            sound[i].envCounter=0;

            sound[i].env += sound[i].envDirection;
            if (sound[i].env <= 0){
              sound[i].env=0;
              sound[i].initialized=false;
            }else if (sound[i].env >= 15) {
              sound[i].env=15;
              sound[i].initialized=false;
            }
          
            sound[i].amp( sound[i].env/15 )
          }
        }

      }

    }
  }


//The flags get set when sound output is restarted by setting the Initial flag (Bit 7 in NR14-NR44), the flag remains set until the sound length has expired (if enabled). A volume envelopes which has decreased to zero volume will NOT cause the sound flag to go off.

  

}






function triggerInterrupt(vector){
  cpu_halted=false
  writeMem16(SP-=2, PC>>8, PC&0xFF)
  PC = vector; 
  IME=false

  return 20
}


function cpu(){

  var cycles =4;

  if (!cpu_halted) {
    cycles = opcodes[readMem(PC)]();
  }
  
  // DIV  = 0xFF04 //Divider Register (R/W)
  // TIMA = 0xFF05 //Timer counter (R/W)
  // TMA  = 0xFF06 //Timer Modulo (R/W)
  // TAC  = 0xFF07 //Timer Control (R/W)

  //DIV register
  // Seems to be running very slightly faster than BGB, possibly 
  // some instructions are returning the wrong number
  if ((divPrescaler += cycles) >255) {
    divPrescaler-=256
    MEM[0xFF04]++;
  }
  if (timerEnable){
    timerPrescaler-= cycles
    while (timerPrescaler<0) {
      timerPrescaler+=timerLength;
      if (MEM[0xFF05]++ ==0xFF) {
        MEM[0xFF05]=MEM[0xFF06];
        // Set interrupt flag here
        MEM[0xFF0F] |= 1<<2;
        cpu_halted = false
      }
    }
  }


  // FF41 - STAT - LCDC Status (R/W)
  // FF42 - SCY - Scroll Y (R/W)
  // FF43 - SCX - Scroll X (R/W)
  // FF44 - LY - LCDC Y-Coordinate (R)
  // FF45 - LYC - LY Compare (R/W)
  // FF46 - DMA - DMA Transfer and Start Address (W)
  // FF47 - BGP - BG Palette Data (R/W) - Non CGB Mode Only
  // FF48 - OBP0 - Object Palette 0 Data (R/W) - Non CGB Mode Only
  // FF49 - OBP1 - Object Palette 1 Data (R/W) - Non CGB Mode Only
  // FF4A - WY - Window Y Position (R/W)
  // FF4B - WX - Window X Position minus 7 (R/W)

  // Complete scan line takes 456 clks.

  //  Mode 0 H-blank period        - 204 clks
  //  Mode 1 V-blank period        - 4560 clks
  //  Mode 2 Reading OAM           - 80 clks
  //  Mode 3 Reading OAM and VRAM  - 172 clks
  //
  //  Mode 2  2_____2_____2_____2_____2_____2___________________2____
  //  Mode 3  _33____33____33____33____33____33__________________3___
  //  Mode 0  ___000___000___000___000___000___000________________000
  //  Mode 1  ____________________________________11111111111111_____

  if (LCD_enabled){
    LCD_scan += cycles;
    
    var mode=0, coincidence=false, draw=false;
    if (LCD_scan <= 80) mode = 2
    else if (LCD_scan <= 252) mode = 3
    else if (LCD_scan < 456) {
      draw = (LCD_lastmode!=0)
      mode = 0
    } else {
      mode = 2
      LCD_scan -= 456;
      MEM[0xFF44] ++;
      if (MEM[0xFF44] > 153) MEM[0xFF44] =0;
      coincidence = (MEM[0xFF44] == MEM[0xFF45]);
    }

    if (MEM[0xFF44] >= 144) mode = 1; //vblank
    else if (draw){
      //Draw scanline
      var LY = MEM[0xFF44];
      var dpy = LY*160;

      var drawWindow = (MEM[0xFF40] & (1<<5)) && LY >= MEM[0xFF4A];
      var bgStopX = drawWindow ? MEM[0xFF4B]-7 : 160;

      //  FF40 - LCDC - LCD Control (R/W)
      //
      //  Bit 7 - LCD Display Enable             (0=Off, 1=On)
      //  Bit 6 - Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
      //  Bit 5 - Window Display Enable          (0=Off, 1=On)
      //  Bit 4 - BG & Window Tile Data Select   (0=8800-97FF, 1=8000-8FFF)
      //  Bit 3 - BG Tile Map Display Select     (0=9800-9BFF, 1=9C00-9FFF)
      //  Bit 2 - OBJ (Sprite) Size              (0=8x8, 1=8x16)
      //  Bit 1 - OBJ (Sprite) Display Enable    (0=Off, 1=On)
      //  Bit 0 - BG Display (for CGB see below) (0=Off, 1=On)

      var baseTileOffset, tileSigned;
      // Tile Data Select
      if (MEM[0xFF40]&(1<<4)) {
        baseTileOffset =  0x8000;
        tileSigned = false;
      } else {
        baseTileOffset =  0x9000;
        tileSigned = true;
      }
      var bgpalette = [
        (MEM[0xFF47])&3,
        (MEM[0xFF47]>>2)&3,
        (MEM[0xFF47]>>4)&3,
        (MEM[0xFF47]>>6)&3
      ]

      function grabTile(n, offset){
        if (tileSigned && n >127){
          var tileptr = offset+(n-256)*16;
        }else{
          var tileptr = offset+n*16;
        }
        var d1 = MEM[tileptr ], d2 = MEM[tileptr +1]
        return pixelDecoder[d1][d2]
      }

      if ( MEM[0xFF40] & 1 ) { // BG enabled
        // BG Tile map display select
        var bgTileMapAddr = MEM[0xFF40]&(1<<3) ? 0x9C00 : 0x9800;

        //scy FF42
        //scx FF43
        // scanline number FF44
        // pixel row = FF44 + FF42
        // tile row = pixel row >> 3
        // 32 bytes per row
        // pixel column = FF43
        // tile column = pixel column >> 3
        
        var x    = MEM[0xFF43] >>3;
        var xoff = MEM[0xFF43] & 7;
        var y = (LY + MEM[0xFF42]) &0xFF;

        // Y doesn't change throughout a scanline
        bgTileMapAddr += (~~(y/8))*32; 
        var tileOffset=baseTileOffset+(y&7)*2;

        var pix = grabTile(MEM[ bgTileMapAddr + x ], tileOffset);

        for (var i=0;i<bgStopX;i++) {
          dpixels[dpy + i] = bgpalette[pix[ xoff++ ]]

          if (xoff==8) {
            x = (x+1)&0x1F; //wrap horizontally in tile map

            pix = grabTile(MEM[ bgTileMapAddr + x ], tileOffset);
            xoff=0;
          }

        }
      }

      // FF4A - WY
      // FF4B - WX

      if ( drawWindow ) { // Window display enable
        // Window Tile map display select
        var wdTileMapAddr = MEM[0xFF40]&(1<<6) ? 0x9C00 : 0x9800;

        var xoff=0;
        var y=LY-MEM[0xFF4A];

        wdTileMapAddr += (~~(y/8))*32; 
        var tileOffset=baseTileOffset+(y&7)*2;

        pix = grabTile(MEM[ wdTileMapAddr ], tileOffset);

        for (var i=Math.max(0,bgStopX);i<160;i++) {
          dpixels[dpy + i] = bgpalette[pix[ xoff++ ]]
          if (xoff==8) {
            pix = grabTile(MEM[ ++wdTileMapAddr ], tileOffset);
            xoff=0;
          }
        }

      }

      if ( MEM[0xFF40] & 2 ) { // Sprite display enabled
        
        // Render sprites
        var height, tileNumMask;
        if (MEM[0xFF40]&(1<<2)) {
          height=16;
          tileNumMask=0xFE; // in 8x16 mode, lowest bit of tile number is ignored
        } else {
          height=8;
          tileNumMask=0xFF; 
        }

        var OBP0 = [
          0,
          (MEM[0xFF48]>>2)&3,
          (MEM[0xFF48]>>4)&3,
          (MEM[0xFF48]>>6)&3
        ],
        OBP1 = [
          0,
          (MEM[0xFF49]>>2)&3,
          (MEM[0xFF49]>>4)&3,
          (MEM[0xFF49]>>6)&3
        ],
        background=bgpalette[0];

        // OAM 4 bytes per sprite, 40 sprites
        for (var i=0xFE9C;i>=0xFE00;i-=4) {
          var ypos = MEM[i]-16+height;
          if ( LY >= ypos-height && LY < ypos) {

            var tileNum = 0x8000 + (MEM[i+2]&tileNumMask)*16,
                xpos = MEM[i+1],
                att = MEM[i+3];
            
            // Bit7   OBJ-to-BG Priority (0=OBJ Above BG, 1=OBJ Behind BG color 1-3)
            //        (Used for both BG and Window. BG color 0 is always behind OBJ)
            // Bit6   Y flip          (0=Normal, 1=Vertically mirrored)
            // Bit5   X flip          (0=Normal, 1=Horizontally mirrored)
            // Bit4   Palette number  **Non CGB Mode Only** (0=OBP0, 1=OBP1)

            var palette = att&(1<<4) ? OBP1 : OBP0 ;
            var behind = att&(1<<7);
            
            if (att&(1<<6)) { // Y flip
              tileNum += (ypos-LY-1)*2 
            }else{
              tileNum += (LY-ypos+height)*2 
            }
            var d1= MEM[tileNum], d2= MEM[tileNum+1],
              row = pixelDecoder[d1][d2];

            if (att&(1<<5)) { // x flip
              if (behind) {
                for (var j = 0; j<Math.min(xpos,8); j++) {
                  if (dpixels[dpy + xpos -1 - j] == background && row[j]) 
                    dpixels[dpy + xpos -1 - j] = palette[row[ j ]];
                }
              }else{
                for (var j = 0; j<Math.min(xpos,8); j++) {
                  if (row[ j ]) dpixels[dpy + xpos -(j+1)] = palette[row[ j ]];
                }
              }
            } else {
              if (behind) { 
                for (var j = Math.max(8-xpos,0); j<8; j++) {
                  if (dpixels[dpy + xpos -8 + j] == background && row[j]) 
                    dpixels[dpy + xpos -8 + j] = palette[row[ j ]];
                }
              } else {
                for (var j = Math.max(8-xpos,0); j<8; j++) {
                  if (row[ j ]) dpixels[dpy + xpos -8 + j] = palette[row[ j ]];
                }
              }
            }

          }
        }

      }

    }

    //  0xFF41 - LCDC Status
    //  Bit 6 - LYC=LY Coincidence Interrupt (1=Enable) (Read/Write)
    //  Bit 5 - Mode 2 OAM Interrupt         (1=Enable) (Read/Write)
    //  Bit 4 - Mode 1 V-Blank Interrupt     (1=Enable) (Read/Write)
    //  Bit 3 - Mode 0 H-Blank Interrupt     (1=Enable) (Read/Write)
    //  Bit 2 - Coincidence Flag  (0:LYC<>LY, 1:LYC=LY) (Read Only)

    if (coincidence){
      if (MEM[0xFF41] & (1<<6)) { //coincidence interrupt enabled
        MEM[0xFF0F] |= 1<<1; // LCD STAT Interrupt flag
        MEM[0xFF41] |= 1<<2; // coincidence flag
      }
    } else MEM[0xFF41] &= 0xFB//~(1<<2)
    if (LCD_lastmode!=mode) { //Mode change
      if (mode == 0) {
        if (MEM[0xFF41] & (1<<3)) MEM[0xFF0F] |= 1<<1;
      } else if (mode == 1) {

        // LCD STAT interrupt on v-blank
        if (MEM[0xFF41] & (1<<4)) MEM[0xFF0F] |= 1<<1;

        // Main V-Blank interrupt
        if (MEM[0xFFFF] & 1) MEM[0xFF0F] |= 1<<0;

        renderDisplayCanvas();

      } else if (mode == 2){
        if (MEM[0xFF41] & (1<<5)) MEM[0xFF0F] |= 1<<1;
      }

      MEM[0xFF41] &= 0xF8;
      MEM[0xFF41] += mode;
      LCD_lastmode=mode;
    }

  }

  // Interrupts
  // FFFF - IE - Interrupt Enable (R/W)
  // FF0F - IF - Interrupt Flag (R/W)
  // Bit 0: V-Blank  Interrupt Enable  (INT 40h)  (1=Enable)
  // Bit 1: LCD STAT Interrupt Enable  (INT 48h)  (1=Enable)
  // Bit 2: Timer    Interrupt Enable  (INT 50h)  (1=Enable)
  // Bit 3: Serial   Interrupt Enable  (INT 58h)  (1=Enable)
  // Bit 4: Joypad   Interrupt Enable  (INT 60h)  (1=Enable)

  if (IME) {
    // if enabled and flag set
    var i = MEM[0xFF0F] & MEM[0xFFFF];

    if ( i&(1<<0) ) { 
      MEM[0xFF0F] &=~(1<<0)
      cycles += triggerInterrupt(0x40)
    } else if ( i&(1<<1) ) {
      MEM[0xFF0F] &=~(1<<1)
      cycles += triggerInterrupt(0x48)
    } else if ( i&(1<<2) ) {
      MEM[0xFF0F] &=~(1<<2)
      cycles += triggerInterrupt(0x50)
    } else if ( i&(1<<3) ) {
      MEM[0xFF0F] &=~(1<<3)
      cycles += triggerInterrupt(0x58)
    } else if ( i&(1<<4) ) {
      MEM[0xFF0F] &=~(1<<4)
      cycles += triggerInterrupt(0x60)
    }

  } //else cpu_halted=false

  return cycles
}


var requestStop = true;
var targ=0x40 //v-blank
function runto(end){
  if (!requestStop) return
  if (ROM.length<1000) return //don't run if no rom loaded

  
  requestStop =false;

  targ=end?end:parseInt(prompt('Address', f(targ,4)),16); 

  run()
}


// Clock speed 4.194304 MHz
// DIV speed 16384 => CPU/256

const soundStepClocks = 4194304/256;
const frameClocks = 4194304/59.7;
const frameIntervalMs = 1000/59.7;
var soundStepCountdown = soundStepClocks;
var frameCountdown = frameClocks;
var thisFrame, lastFrame = performance.now();

function run(time){
  thisFrame = time || performance.now()
  if (limitFrameRate){
    let d = thisFrame - lastFrame
    if (d >= frameIntervalMs - 0.1) {
      lastFrame = thisFrame - (d % frameIntervalMs)
    } else {
      requestAnimationFrame(run);
      return
    }
  }

  doGamepad()

  while (true){
    var cycles = cpu();
    soundStepCountdown -= cycles;
    frameCountdown -= cycles;

    if (soundStepCountdown < 0){
      soundStepCountdown += soundStepClocks;
      soundStep();
    }
    if (frameCountdown < 0){
      frameCountdown += frameClocks;
      break;
    }
    if (PC == targ) break;
  }

  if (PC != targ && !requestStop) {
    if (limitFrameRate){
      window.requestAnimationFrame(run);
    }else{
      frameCountdown+=frameClocks*2 //this can go much higher
      window.setTimeout(run, 0);
    }
  } else {
    requestStop=true
    sound[1].amp(0);
    sound[2].amp(0);
    sound[3].amp(0);
    sound[4].amp(0);
  }
  if (debugOn) debugData()
}



const ioMap={
0xFF00:"JOYP ",
0xFF01:"SB ",
0xFF02:"SC ",
0xFF04:"DIV ",
0xFF05:"TIMA ",
0xFF06:"TMA ",
0xFF07:"TAC ",
0xFF0F:"IF ",
0xFF10:"NR10 ",
0xFF11:"NR11 ",
0xFF12:"NR12 ",
0xFF13:"NR13 ",
0xFF14:"NR14 ",
0xFF16:"NR21 ",
0xFF17:"NR22 ",
0xFF18:"NR23 ",
0xFF19:"NR24 ",
0xFF1A:"NR30 ",
0xFF1B:"NR31 ",
0xFF1C:"NR32 ",
0xFF1D:"NR33 ",
0xFF1E:"NR34 ",
0xFF20:"NR41 ",
0xFF21:"NR42 ",
0xFF22:"NR43 ",
0xFF23:"NR44 ",
0xFF24:"NR50 ",
0xFF25:"NR51 ",
0xFF26:"NR52 ",
//0xFF3F:"Wave Pattern",
0xFF40:"LCDC ",
0xFF41:"STAT ",
0xFF42:"SCY ",
0xFF43:"SCX ",
0xFF44:"LY ",
0xFF45:"LYC ",
0xFF46:"DMA ",
0xFF47:"BGP ",
0xFF48:"OBP0 ",
0xFF49:"OBP1 ",
0xFF4A:"WY ",
0xFF4B:"WX ",
//0xFF4D:"KEY1 ",
//0xFF4F:"VBK ",
//0xFF51:"HDMA1 ",
//0xFF52:"HDMA2 ",
//0xFF53:"HDMA3 ",
//0xFF54:"HDMA4 ",
//0xFF55:"HDMA5 ",
//0xFF56:"RP ",
//0xFF68:"BCPS/BGPI ",
//0xFF69:"BCPD/BGPD ",
//0xFF6A:"OCPS/OBPI ",
//0xFF6B:"OCPD/OBPD ",
//0xFF6C:"Undocumented (FEh) ",
//0xFF70:"SVBK ",
//0xFF72:"Undocumented (00h) ",
//0xFF73:"Undocumented (00h) ",
//0xFF74:"Undocumented (00h) ",
//0xFF75:"Undocumented (8Fh) ",
//0xFF76:"Undocumented (00h) ",
//0xFF77:"Undocumented (00h) ",
0xFFFF:"IE "
}











var debugOn=false;
function showDebug(on){
  debugOn = on;
  document.getElementById('dbg').style.display= on?'block':'none';
  if (on) debugData();
}


function ascii(c){
  return ".................................!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.€.‚ƒ„…†‡ˆ‰Š‹Œ.Ž..‘’“”•–—˜™š›œ.žŸ ¡¢£¤¥¦§¨©ª«¬.®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ".charAt(c)
  .replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function f(a,l) {return ("0000"+a.toString(16).toUpperCase()).slice(-l||-2)}
(debugData=function(){

  var debugOffset = PC&0xFF00;
  var debug = "";
  for (var j=0;j<16;j++) {

    debug+= "$"+f(debugOffset + j*16,4)+"   "
    for (var i=0;i<16;i++) {
      var q=i+j*16 + debugOffset;
      debug+="<span title='$"+ f(q,4) +"'"
      debug+= PC==q ? " style='color:red'>":">"
      debug+=f(readMem(q))+"</span>"
 
      debug+=(i==7?"|":" ")
      
    }
    debug+="|  "
    for (var i=0;i<16;i++) {
      var c=readMem(i+j*16 + debugOffset)
      debug+= ascii(c);
    }
    
    
    debug+="\n"
  }


  debug+="\nAF: "+ f(REG[A]) + f((FLAGS.Z << 7) + (FLAGS.N << 6) + (FLAGS.H << 5) + (FLAGS.C << 4))+"        Z: "+FLAGS.Z
  debug+="\nBC: "+ f(REG[B])+ f(REG[C])+"        N: "+FLAGS.N
  debug+="\nDE: "+ f(REG[D])+ f(REG[E])+"        H: "+FLAGS.H
  debug+="\nHL: "+ f(REG[H])+ f(REG[L])+"        C: "+FLAGS.C
  debug+="\nSP: "+ f(SP,4)
  debug+="\nPC: "+ f(PC,4)
  debug+="\n\nIME:"+IME

  document.getElementById('out').innerHTML=debug;

  debug=""
  for (var i in ioMap) {
    var r=f(readMem(i));
    debug+="$"+f(i*1,4)+": "+(r==0?"--":r)+" - "+ioMap[i]+" \n"
  }
  document.getElementById('io').innerHTML=debug

  debug=""
  for (var i=SP+20;i>=SP-20;i-=2) {
    if (i>0xfffe || i<0) {debug+=" ----  ----\n"}else{
      var r=f(readMem(i+1)) + f(readMem(i));
      debug+="$"+f(i,4)+": "+r+(i==SP?"*":"")+" \n"
    }
  }
  document.getElementById('stack').innerHTML=debug

})();



var openFile = function(event) {
  var input = event.target;

  var reader = new FileReader();
  reader.onload = function(){
    ROM = new Uint8Array(reader.result);
    FirstROMPage = ROM.slice(0,256)

    //Overwrite first page with bootcode
    for (var i=0;i<256;i++) ROM[i]=bootCode[i];

    // According to BGB
    MEM[0xFF41] = 1
    MEM[0xFF43] = 0

    resetSoundRegisters()

    ROMbank = 1; ROMbankoffset = (ROMbank-1)*0x4000;
    RAMbank =0; RAMbankoffset = RAMbank*0x2000 - 0xA000;
    RAMenabled=false; MBCRamMode=0;
    divPrescaler=0, timerPrescaler=0, timerLength=1, timerEnable=false;
    LCD_enabled = false, LCD_lastmode=1, LCD_scan=0;
    PC=0, SP=0,IME=false,cpu_halted=false;

    
  };
  reader.readAsArrayBuffer(input.files[0]);
};


var fileinput=document.getElementById("fileinput");
function saveSram(a){
  a.download=fileinput.files[0].name.replace(/\.gbc?$/,'.sav')
  var len = [0,2,8,32,128,64][ROM[0x149]]*1024

  if (ROM[0x147]==5 || ROM[0x147]==6) len=512; //MBC2

  a.href='data:application/octet-stream;base64,'+btoa(String.fromCharCode(...cartRAM.slice(0,len)))
}
function loadSram(e) {
  var reader = new FileReader();
  reader.onload = function(){ cartRAM = new Uint8Array(reader.result); };
  reader.readAsArrayBuffer(e.target.files[0]);
}
function saveState(){
  localStorage.savestate= JSON.stringify({
    PC:PC,
    SP:SP,
    REG: REG.join(),
    FLAGS: FLAGS,
    IME:IME,
    cpu_halted:cpu_halted,
    MEM: MEM.join(),
    //ROM: ROM,  //too big for localstorage
    ROMbank: ROMbank,
    ROMbankoffset:ROMbankoffset,
    cartRAM: cartRAM.join(),
    RAMbank: RAMbank,
    RAMbankoffset: RAMbankoffset,
    MBCRamMode: MBCRamMode,
    LCD_enabled: LCD_enabled,
    LCD_lastmode: LCD_lastmode
  })
}
function loadState(){
  if (!localStorage.savestate) return
  for (var i=0;i<256;i++) ROM[i]=FirstROMPage[i];
  var all=JSON.parse(localStorage.savestate);
  MEM = Uint8Array.from(all.MEM.split(","));
  PC=all.PC;
  SP=all.SP;
  REG=Uint8Array.from(all.REG.split(","));
  FLAGS=all.FLAGS;
  IME=all.IME;
  cpu_halted=cpu_halted;
  //rom=rom
  ROMbank= all.ROMbank;
  ROMbankoffset= all.ROMbankoffset;
  cartRAM= Uint8Array.from(all.cartRAM.split(","));
  RAMbank= all.RAMbank;
  RAMbankoffset= all.RAMbankoffset;
  MBCRamMode= all.MBCRamMode;
  LCD_enabled= all.LCD_enabled;
  LCD_lastmode= all.LCD_lastmode;
}

if (fileinput.files.length) openFile({"target":{"files":fileinput.files}})