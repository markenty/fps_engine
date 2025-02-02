// audio.js -- sounds (both audio and music) for the game
//
// Copyright (C) 2019, Nicholas Carlini <nicholas@carlini.com>.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var sounds = {}

var context = new AudioContext();
var play = (which, location) => {
    var m = context.createBuffer(1, which.length, 48e3);
    m.copyToChannel(new Float32Array(which), 0, 0);
    var src = context.createBufferSource();
    var panner = context.createStereoPanner();
    src.buffer = m;
    src.connect(panner);
    panner.pan.value = location ? Math.cos(angle_between(location, camera.position) + camera.theta + Math.PI/2) : 0;
    panner.connect(context.destination);
    src.start(); // QQ
    return src;
};

// -------------------------------------------------------------------
// Music-related code has been removed. (Music will no longer load or play.)
// -------------------------------------------------------------------

// var musicnotes;
// var music_timeouts = [];
// function doplay() {
//     if (music_timeouts.length < 2 && !going_back && can_play_music) {
//         musicnotes.map((note,i) =>
//             note.map(n => music_timeouts.push(setTimeout(_ => {
//                 music_timeouts.shift();
//                 play(n, NewVector(20, -40, 0));
//                 if (music_timeouts.length == 1) {
//                     doplay();
//                 }
//             }, i * 200 + 400)))
//         );
//     }
// }

// var toaudio = x => transpose(x).map(sum);

// Disable music loading by making load() an empty function.
function load() {
    // Music has been removed.
}

var arr;
function setup_audio() {
    load();  // This does nothing now.
    arr = [100, 7, 55, 25, 35, 20, , 15, , , 4, , , , 2, 33, -8, -23, 20, , 23, 4, -48, 30,
           100, , 5, 100, 55, 20, , , -10, , , , , , , , -40, -5, 15, , , , , 30,
           , , 5, 100, 55, 20, , , -10, , , , , , , , -40, -5, 15, , , , , 30,
           300, 10, 25, 5, 20, 25, 10, , , 50, , , , 50, , , , , 10, , 50, 50, , 60,
           300, 5, 15, 5, 20, 25, 10, , , 50, , , , 50, , , , , 10, , 50, 50, , 60,
           300,45,55,,55,15,,-10,,,,,,,,,,,25,,,,,30,
           0,5,5,,45,5,,-10,,,,,,,,,-25,,5,,,,,300];
    arr = reshape(arr.map(function(x) { return x / 100; }), 24);
    
    sounds.boom = toaudio([jsfxr(arr[0])]);
    sounds.gun = toaudio([jsfxr(arr[1]), jsfxr(arr[2])]);
    sounds.collect  = toaudio([jsfxr(arr[3])]);
    sounds.collect2 = toaudio([jsfxr(arr[4])]);
    sounds.clock = toaudio([jsfxr(arr[5]), jsfxr(arr[5]).slice(2000)]);
    sounds.hit = toaudio([jsfxr(arr[6]), jsfxr(arr[1])]);
}
