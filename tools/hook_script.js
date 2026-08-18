'use strict';

// CRITICAL: install the anti-exit hooks FIRST, synchronously, before anything else,
// to win the race against the app's own kill-switch logic.
if (Java.available) {
    Java.perform(function () {
        try {
            var SystemClass = Java.use('java.lang.System');
            SystemClass.exit.overload('int').implementation = function (code) {
                send({ kind: 'log', msg: 'BLOCKED System.exit(' + code + ')' });
            };
        } catch (e) {
            send({ kind: 'log', msg: 'failed to hook System.exit: ' + e });
        }
        try {
            var Runtime = Java.use('java.lang.Runtime');
            Runtime.exit.overload('int').implementation = function (code) {
                send({ kind: 'log', msg: 'BLOCKED Runtime.exit(' + code + ')' });
            };
            Runtime.halt.overload('int').implementation = function (code) {
                send({ kind: 'log', msg: 'BLOCKED Runtime.halt(' + code + ')' });
            };
        } catch (e) {}
        try {
            var ProcessClass = Java.use('android.os.Process');
            ProcessClass.killProcess.overload('int').implementation = function (pid) {
                send({ kind: 'log', msg: 'BLOCKED Process.killProcess(' + pid + ')' });
            };
        } catch (e) {}
        send({ kind: 'log', msg: 'anti-exit hooks installed' });
    });
} else {
    send({ kind: 'log', msg: 'Java bridge not available' });
}

// also hook the native libc exit family, in case the kill happens below the JVM
['exit', '_exit', '_Exit'].forEach(function (name) {
    var ptr = Module.findExportByName(null, name);
    if (ptr) {
        Interceptor.replace(ptr, new NativeCallback(function (code) {
            send({ kind: 'log', msg: 'BLOCKED native ' + name + '(' + code + ')' });
        }, 'void', ['int']));
    }
});

var seen = {};

function scanMemory() {
    Process.enumerateRanges('rw-').forEach(function (range) {
        if (range.size > 150 * 1024 * 1024) return;
        try {
            Memory.scan(range.base, range.size, '89 50 4E 47 0D 0A 1A 0A', {
                onMatch: function (address, size) {
                    var key = address.toString();
                    if (seen[key]) return 'continue';
                    seen[key] = true;
                    try {
                        var remain = range.base.add(range.size).sub(address).toInt32();
                        var dumpSize = Math.min(remain, 4 * 1024 * 1024);
                        var buf = Memory.readByteArray(address, dumpSize);
                        send({ kind: 'png', address: key, size: dumpSize }, buf);
                    } catch (e) {
                        send({ kind: 'error', address: key, error: e.toString() });
                    }
                    return 'continue';
                },
                onError: function () {},
                onComplete: function () {}
            });
            Memory.scan(range.base, range.size, 'FF D8 FF', {
                onMatch: function (address, size) {
                    var key = 'jpg' + address.toString();
                    if (seen[key]) return 'continue';
                    seen[key] = true;
                    try {
                        var remain = range.base.add(range.size).sub(address).toInt32();
                        var dumpSize = Math.min(remain, 6 * 1024 * 1024);
                        var buf = Memory.readByteArray(address, dumpSize);
                        send({ kind: 'jpg', address: key, size: dumpSize }, buf);
                    } catch (e) {}
                    return 'continue';
                },
                onError: function () {},
                onComplete: function () {}
            });
            Memory.scan(range.base, range.size, '4F 67 67 53', { // OggS
                onMatch: function (address, size) {
                    var key = 'ogg' + address.toString();
                    if (seen[key]) return 'continue';
                    seen[key] = true;
                    try {
                        var remain = range.base.add(range.size).sub(address).toInt32();
                        var dumpSize = Math.min(remain, 6 * 1024 * 1024);
                        var buf = Memory.readByteArray(address, dumpSize);
                        send({ kind: 'ogg', address: key, size: dumpSize }, buf);
                    } catch (e) {}
                    return 'continue';
                },
                onError: function () {},
                onComplete: function () {}
            });
        } catch (e) {}
    });
}

function hookOpen(name) {
    var ptr = Module.findExportByName(null, name);
    if (!ptr) {
        send({ kind: 'log', msg: 'no export for ' + name });
        return;
    }
    Interceptor.attach(ptr, {
        onEnter: function (args) {
            try {
                this.path = (name === 'openat') ? args[1].readCString() : args[0].readCString();
            } catch (e) {
                this.path = null;
            }
        },
        onLeave: function (retval) {
            if (this.path && (this.path.indexOf('resource') >= 0 || this.path.indexOf('assets/game') >= 0 || this.path.indexOf('.data') >= 0)) {
                send({ kind: 'open', func: name, path: this.path, fd: retval.toInt32() });
            }
        }
    });
    send({ kind: 'log', msg: 'hooked ' + name + ' @ ' + ptr });
}

hookOpen('open');
hookOpen('openat');
hookOpen('fopen');

send({ kind: 'log', msg: 'script loaded, starting periodic memory scan' });
setInterval(scanMemory, 3000);
scanMemory();
