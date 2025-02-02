// audio.js -- sounds (both audio and music) for the game

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
    var m = context.createBuffer(1,which.length,48e3);
    m.copyToChannel(new Float32Array(which), 0, 0);
    var src = context.createBufferSource();
    var panner = context.createStereoPanner();
    src.buffer = m;
    src.connect(panner);
    panner.pan.value = location ? Math.cos(angle_between(location, camera.position) + camera.theta + Math.PI/2) : 0;;
    panner.connect(context.destination)
    src.start(); // QQ
    return src;
};

var musicnotes;
var music_timeouts=[];
function doplay() {
    if (music_timeouts.length < 2 && !going_back && can_play_music) {
        musicnotes.map((note,i) =>
                       note.map(n=>music_timeouts.push(setTimeout(_ => {
                           music_timeouts.shift();
                           play(n, NewVector(20,-40,0));
                           if (music_timeouts.length == 1) {
                               doplay();
                           }
                       }, i*200+400)))
                      )
    }
}

var toaudio = x => transpose(x).map(sum);

function load() {
    // Define new note arrays for a dubstep vibe.
    // The numbers represent semitone offsets. In this version, we use lower values
    // (and later subtract 24 semitones) to get deep, bass‐heavy tones.
    var dubstep_bass = [null, 2, 2, 1, null, 0, null, 0, 1, 2, null, 2, 1, 0, null, 0];
    var dubstep_lead = [4, 5, 7, 5, 4, 2, 4, 5, 7, 5, 4, 2];
    
    // Define the song sections.
    // Each section is defined as:
    // [melodyOffset, melodyDuration, harmonyDuration, melodyArray, (optional) harmonyArray]
    var arr = [
        [0, 0.8, 0.8, dubstep_bass],
        [0, 0.5, 0.5, dubstep_lead],
        [0, 0.8, 0.8, dubstep_bass],
        [0, 0.5, 0.5, dubstep_lead],
        [0, 1, 1, dubstep_bass, dubstep_lead]
    ];
    
    // Prepare the global musicnotes array (300 time slots)
    musicnotes = range(300).map(function() { return []; });
    var offset = 0;
    
    // Helper function: converts note values into sound buffers via jsfxr.
    // For a dubstep sound, we lower each note by 24 semitones (2 octaves)
    // and adjust the jsfxr parameters for a heavier tone.
    var addnote = function(kind, note, where, length) {
        if (note == null) return;
        var adjustedNote = note - 24; // Lower by two octaves
        var time = length * 0.11 + 0.13;
        musicnotes[where + offset].push(
            toaudio(
                [adjustedNote / 12, adjustedNote / 12 - 1].map(function(f) {
                    f = Math.pow(2, f / 2) * 0.25;
                    return kind 
                        ? jsfxr([3, 0.15, time, 0.2, 0.4, f, , , , , , , 0.6, , , -0.5, , 0.3, , , , 0.2])
                        : jsfxr([3, 0.15, time + 0.1, 0.35, 0.6, f, , , , , , , , , , 0.2, , , 0.1]);
                })
            )
        );
    };
    
    // Sequentially process each section and schedule note playback.
    var donext = function() {
        if (!arr.length) {
            main_go();
            return;
        }
        var section = arr.shift();
        var offset_melody = section[0],
            duration_melody = section[1],
            duration_harmony = section[2];
        var parts = section.slice(3);
        parts.forEach(function(notesArray, j) {
            notesArray.forEach(function(note, i) {
                addnote(
                    (!j && arr.length < 5), 
                    note == null ? null : note + offset_melody * (!j ? 1 : 0),
                    i * (j ? duration_harmony : duration_melody),
                    (j ? duration_harmony : duration_melody)
                );
            });
        });
        offset += duration_melody * parts[0].length;
        jQ.innerHTML = (6 - arr.length) + "/6";
        setTimeout(arr.length ? donext : main_go, 1);
    };
    
    setTimeout(donext, 1);
}

var arr;
function setup_audio() {
    load();  // This now calls the dubstep-style load() function
    arr = [100, 7, 55, 25, 35, 20, , 15, , , 4, , , , 2, 33, -8, -23, 20, , 23, 4, -48, 30,
           100, , 5, 100, 55, 20, , , -10, , , , , , , , -40, -5, 15, , , , , 30,
           , , 5, 100, 55, 20, , , -10, , , , , , , , -40, -5, 15, , , , , 30,
           300, 10, 25, 5, 20, 25, 10, , , 50, , , , 50, , , , , 10, , 50, 50, , 60,
           300, 5, 15, 5, 20, 25, 10, , , 50, , , , 50, , , , , 10, , 50, 50, , 60,
           300,45,55,,55,15,,-10,,,,,,,,,,,25,,,,,30,
           0,5,5,,45,5,,-10,,,,,,,,,-25,,5,,,,,300];
    arr = reshape(arr.map(function(x) { return x / 100; }), 24);



    sounds.boom = toaudio([jsfxr(arr[0])]);
    sounds.gun = toaudio([jsfxr(arr[1]),jsfxr(arr[2])]);
    sounds.collect  = toaudio([jsfxr(arr[3])])
    sounds.collect2 = toaudio([jsfxr(arr[4])])
    sounds.clock = toaudio([jsfxr(arr[5]), jsfxr(arr[5]).slice(2000)])
    sounds.hit = toaudio([jsfxr(arr[6]),jsfxr(arr[1])])
}
