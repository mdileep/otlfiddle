const { spawnSync, execFile, ChildProcess } = require('child_process');

const util = require('util');
const fs = require('fs').promises;
const temp = require('temp');
const shellEnv = require('shell-env').sync();

const execFilePromise = util.promisify(execFile);

const electron = require('electron');

const path = require('path');

const app = process.type === 'renderer' ? electron.remote.app : electron.app;
// const otlpath = path.join(app.getAppPath(), '/public/otlserver.py');
const decompilepath = path.join(app.getAppPath(), '/public/decompile.py');

let pythonVersion = 'python3';

export class OTLServer {
  outputFile: string;

  child: ChildProcess;

  constructor(origFile: string, errorCallback, okCallback) {
    this.outputFile = temp.path({ suffix: '.otf' });
    this.featureFile = temp.path({ suffix: '.fea' });
    this.origFile = origFile;
    this.errorCallback = errorCallback;
    this.okCallback = okCallback;
    // console.log(`Spawning child`);
    // this.child = spawn('python3', [otlpath, origFile, this.outputFile]);
    // console.log(this.child);
    // this.child.on('error', errorCallback);
    // this.child.on('close', (code) => {
    //   console.log(`Child closed error ${code}`);
    // });
    // this.child.stderr.on('data', (data) => {
    //   data = data.toString();
    //   console.log(data);
    // });
    // this.child.stdout.on('data', (data) => {
    //   data = data.toString();
    //   console.log(data);
    //   if (data === 'OK\n') {
    //     okCallback(this.outputFile);
    //   } else {
    //     errorCallback(data);
    //   }
    // });
  }

  compile(feature: string) {
    // console.log('Writing feature');
    // console.log(this.child);
    // this.child.stdin.write(feature.length - 1 + '\n');
    // this.child.stdin.write(feature);
    let success = true;
    let tables = ['GSUB', 'GPOS'];
    if (feature.indexOf('table GDEF') !== -1) {
      tables = ['GSUB', 'GPOS', 'GDEF'];
    }

    // eslint-disable-next-line promise/catch-or-return
    fs.writeFile(this.featureFile, feature)
      .then(() => {
        return execFile(
          pythonVersion,
          [
            '-m',
            'fontTools.feaLib',
            '-o',
            this.outputFile,
            '-t',
            ...tables,
            '--',
            this.featureFile,
            this.origFile,
          ],
          {
            env: shellEnv,
          }
        );
      })
      // eslint-disable-next-line promise/always-return
      .then((child) => {
        // child.stdout.on("data", (d) => {
        //     console.log(`makeotf stdout: ${d}`)
        //   });
        child.stderr.on('data', () => {
          success = false;
          // console.log(`feaLib stderr: ${d}`);
        });
        child.on('error', () => {
          this.errorCallback();
        });

        child.on('close', () => {
          if (success) {
            // console.log(`OK, written to ${this.outputFile}`);
            this.okCallback(this.outputFile);
          } else {
            this.errorCallback();
          }
        });
      });
  }
}

export function checkPythonLibs(): Record<string, unknown> {
  let res = spawnSync('python3', ['-c', 'import fontTools'], {
    env: shellEnv,
  });
  if (res.status === 0) {
    return res;
  }
  // Try python 2
  res = spawnSync('python', ['-c', 'import fontTools'], {
    env: shellEnv,
  });
  if (res.status === 0) {
    pythonVersion = 'python';
  }
  return res;
}

export function decompileOTF(file: string): Promise<Record<string, unknown>> {
  return execFilePromise(pythonVersion, [decompilepath, file], {
    env: shellEnv,
  });
}
