(function  (argument) {
//all I support is webkitIndexDB
window.indexedDB =window.webkitIndexedDB;
window.IDBTransaction = window.webkitIDBTransaction;
window.IDBKeyRange = window.webkitIDBKeyRange ;

if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.")
}

//templete of the DataBase
/*const DownloadData = [
  { downloadurl: "http://testUrl", destinationDir: "/sdcard/downloads/", maxSize: 10000000,isFinished: true }
];*/

const DB_NAME = "DownloadDB";
const DB_VERSION = 1.0;
const DB_STORE_NAME = 'DownloadDatebase';

var db;
// the responseHash set for synchronous the downloadProgress
var ResponseSet={
};
//the response's current download size
var CurrentProgress = {
};

function initDb() {
    console.debug("initDb ...");
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = function (evt) {
        db = this.result;
        console.debug("initDb DONE");
    };
    req.onerror = function (evt) {
        console.log("initDb:"+evt.target.errorCode);
    };
    req.onupgradeneeded = function (evt) {
        console.debug("initDb.onupgradeneeded");
        //use the downloadUrl as the key
        var store = evt.currentTarget.result.createObjectStore(
          DB_STORE_NAME, { keyPath: 'downloadurl', autoIncrement: true });

        store.createIndex('destinationDir', 'destinationDir', { unique: false });
        store.createIndex('isFinished', 'isFinished', { unique: false });
    };
}

initDb();
//insert new item into the database
function insertData (newData) {
    if (!db) {
        console.error("addPublication: the db is not initialized");
        return;
    }
    var tx = db.transaction(DB_STORE_NAME, 'readwrite');
    var store = tx.objectStore(DB_STORE_NAME);
    var req = store.add(newData);
    req.onsuccess = function (evt) {
        console.debug("Insertion in DB successful");
        console.log("insert successful !");
    };
    req.onerror = function(e) {
        console.error("add error"+this.error);
    };
}

//removing the data from the database
function removeData (file_url) {
    if (!db) {
        console.error("removeData:the db is not initialized");
        return;
    };

    console.log("removeData is called.");
    var request = db.transaction(DB_STORE_NAME,'readwrite')
                        .objectStore(DB_STORE_NAME)
                        .delete(file_url);
    request.onsuccess = function  (evt) {
        console.log("the "+file_url +" is gone!");
    }
}

//search the destinationDir from the database
function searchData (file_url,callback) {
    if (!db) {
        console.error("searchData:the db is not initialized");
        return;
    };
    var request = db.transaction([DB_STORE_NAME])
                        .objectStore(DB_STORE_NAME)
                        .get(file_url);
    request.onsuccess =function  (evt) {
        console.log(" destinationDir of the download : " + request.result.destinationDir);
        callback(request.result.destinationDir);
    }
}

function searchUnfinished (callback) {
    var unfinishedlist = new Array();
    var arrayIndex = 0;
    var request = db.transaction([DB_STORE_NAME])
                      .objectStore(DB_STORE_NAME);
    request.openCursor().onsuccess = function  (event) {
        var cursor = event.target.result;
        if (cursor) {
            console.log("downloadurl: "+ cursor.key+"  destinationDir: " + cursor.value.destinationDir+"  maxSize: "+cursor.value.maxSize+"  isFinished: "+cursor.value.isFinished);         
            if (cursor.value.isFinished == false) {
                //add the downloadurl into the UnfinishedList
                unfinishedlist[arrayIndex] = cursor.key;
                arrayIndex++;
            };
            cursor.continue();
        }else{
            console.log("no more entries!");
            console.log("the unFInishedList : " + unfinishedlist.length);
            callback(unfinishedlist);
        }
    }
}
//search all the information from the database
function searchInformation (file_url,callback) {
    if (!db) {
        console.error("searchInformation:the db is not initialized");
        return;
    };
    var request = db.transaction([DB_STORE_NAME])
                        .objectStore(DB_STORE_NAME)
                        .get(file_url);
    request.onsuccess =function  (evt) {
        callback(request.result);
        console.log("searchInformation is called .");
        //console.log(" destinationDir of the download : " + JSON.stringify(request.result));
    }
}

//update the date by key
function updateData (file_url) {
    if (!db) {
        console.error("updateData:the db is not initialized");
        return;
    };
    var requestObject = db.transaction([DB_STORE_NAME],'readwrite')
                                  .objectStore(DB_STORE_NAME);

    var requestRes= requestObject.get(file_url);
    requestRes.onsuccess =function  (evt) {
        console.log("the downloadurl's status has updated."  );
        requestRes.result.isFinished = true;
        requestObject.put(requestRes.result);
    }
}

/* nodejs part */
// Dependencies
var fs = require('fs');
var url = require('url');
var http = require('http');
var options;
http.globalAgent.maxSocket = 50;
// Function to download file using HTTP.get  keep this
var download_file_httpget = function(download_url) {
    options ={
        host: url.parse(download_url).hostname,
        port: url.parse(download_url).port,
        path: url.parse(download_url).path,
        headers :{
            range :'bytes=0-'
        }
    }
}

function DownloadManager () {
}
//hasSet for the downloadUrl, and this can be seen allover the Html
var hashSet= {
};

/*
**Delete the file by the path
*/
DownloadManager.prototype.cancel = function  (file_url) {
    //file_url must not be null string or undefined
    if ( file_url !== undefined && file_url !== null && file_url.length >0 ) {
        console.log("legalUrl , move on.");
    }else{
        console.log("illlegal url.");
        return false;
    }

    //file_url must not be null string or undefine
    if (hashSet[file_url]!=null) {
        this.pause(file_url);
    };

    //the file_path is not rightly called
    searchData(file_url,function(file_path) {
        fs.unlink(file_path , function  () {
            console.log("the file was deleted by DownloadManager.");
        });
        removeData(file_url);
    });

}

/*
**get the unfinishedlist
*/
DownloadManager.prototype.getWorkingList = function  (callback) {
    console.log("got the unFInishedList");
    searchUnfinished(function  (resultlist) {
        callback(resultlist);
    });
}

/*
**get download progress
*/
DownloadManager.prototype.getDldProgress = function  (file_path) {
    var filestate = fs.statSync(file_path);
    console.log("the file size is : " + filestate.size);
    return filestate.size;
}
/*
**get download progress
*/
DownloadManager.prototype.getProgress = function  (file_url,onGetProgress,onErrorCallback){
    var event={
        msg : '',
        data: {
            current : '',
            max : ''
        }
    };
    //file_url must not be null string or undefined
    if ( file_url !== undefined && file_url !== null && file_url.length >0 ) {
        console.log("legalUrl , move on.");
    }else{
        onErrorCallback("illlegalUrl");
        console.log("illlegal url.");
        return ;
    }

    //if the url don't have one Instance ,return msg with error NoneInstanceError
    if(hashSet[file_url] == null)
    {
        console.log("this download isn't exist.");
        onErrorCallback("NoneInstanceError");
        return ;
    }


    searchInformation(file_url,function(SeachResult) {
        var filestate = fs.statSync(SeachResult.destinationDir);
        console.log("the file size is : " + filestate.size);

        event.data.current = filestate.size;
        event.data.max = SeachResult.maxSize;
        if (!ResponseSet[file_url]) {
            onGetProgress(result);
        };
    });

    if (ResponseSet[file_url]) {
        ResponseSet[file_url].on('data', function(data) {
            console.log("the getProgress got the response!!! the CurrentProgress[file_url] : "+CurrentProgress[file_url]);
            event.msg = 'DOWNLOADING';
            event.data.current = CurrentProgress[file_url];
            onGetProgress(event);
        }).on('end', function() {
            if (event.data.current == event.data.max) {
                event.msg = 'FINISHED';
            }else{
                event.msg = 'PAUSED';
            }
            onGetProgress(event);
        });
        ResponseSet[file_url].on('error',function(e) {
            console.log('problem with request: ' + e.message);
            onErrorCallback("NoneInstanceError");
        });
    };
}

/*
**pause download
*/
DownloadManager.prototype.pause = function  (file_url) {
    //file_url must not be null string or undefined
    if ( file_url !== undefined && file_url !== null && file_url.length >0 ) {
        console.log("legalUrl , move on.");
    }else{
        console.log("illlegal url.");
        return false;
    }

    if(hashSet[file_url] == null)
    {
        console.log("this download isn't exist.");
        return false;
    }
    console.log("the pause is called .");
    hashSet[file_url].destroy();
    return true;
}


/*
**resume download
*/
DownloadManager.prototype.resume = function  (file_url,onErrorCallback,onProgressChange) {
    //check online or not
    if(navigator.onLine == false){
        onErrorCallback("OffLine");
        return ;
    }

    //file_url must not be null string or undefined
    if (file_url !== undefined  && file_url !== null && file_url.length >0 ) {
        console.log("legalUrl , move on.");
    }else{
        onErrorCallback("illlegalUrl");
        console.log("illlegal url.");
        return ;
    }

    var _this = this;
    download_file_httpget(file_url);

    var currentSize = 0;
    var result= {
        msg : '',
        data : {
            current : 0,
            max : 0
        }
    };

    var content_length;
    var Response;
    var DestinationDir;
    searchInformation(file_url,function(SeachResult) {

        //NoneInstance error
        if (!SeachResult) {
            console.log("the download don't exist.");
            onErrorCallback("NoneInstance");
            return;
        };

        DestinationDir = SeachResult.destinationDir;
        result.data.max = parseInt(SeachResult.maxSize);
        //file option
        var optionsWrite = {
              flags : "a+",
              mode : 0666
        };

        //create the writeStream
        var Resumefile = fs.createWriteStream(DestinationDir,optionsWrite);
        var dataStart = _this.getDldProgress(DestinationDir);
        if (dataStart >= parseInt(SeachResult.maxSize)) {
            console.log("already finished the download!.");
            onErrorCallback("alreadyExist");
            return;
        };
        currentSize = dataStart;
        options.headers.range = 'bytes='+ dataStart+'-';
        console.log("already download : " + dataStart);
        //http request
        hashSet[file_url]= http.get(options, function(res) {

            //check the url is illlegal or not
            if (res.statusCode == 404) {
                console.log("the res.status : " + res.statusCode );
                onErrorCallback("wrongUrl");
                return;
            };

            content_length = res.headers['content-length'];
            ResponseSet[file_url] = res;
            //response deal
            res.on('data', function(data) {
                //console.log("the date size is :"+ parseInt(data.length));
                currentSize += parseInt(data.length);
                CurrentProgress[file_url] = currentSize;
                result.msg = "DOWNLOADING";
                result.data.current = JSON.stringify(currentSize);
                onProgressChange(result);
                Resumefile.write(data);
            }).on('end', function() {
                Resumefile.end();
                console.log("the Content-Range : " + JSON.stringify(res.headers)  + "the content-length is :" +parseInt(content_length));
                //progress callback use the data.length to show the progress
                console.log("filesize is " + _this.getDldProgress(DestinationDir)+"and the currentSize:" + currentSize );
                if (currentSize==result.data.max) {
                    console.log("is this finished called?");
                    result.msg = 'FINISHED';
                    updateData(file_url);
                }else{
                    result.msg = 'PAUSED';
                };

                result.data.current = JSON.stringify(currentSize);
                onProgressChange(result);
            });

            res.on('error',function(e) {
                onErrorCallback(e);
                console.log('problem with request: ' + e.message);
            });
        }).on("error",function(e){
            onErrorCallback(e);
            console.log("the request got error : "+ e);
        });
    });
};

/*
**download by httpGet
*/
DownloadManager.prototype.start = function(file_url,onErrorCallback,onProgressChange,DownloadOption) {

    if(navigator.onLine == false){
        onErrorCallback("OffLine");
        return ;
    }

    //file_url must not be null string or undefined
    if (file_url !== undefined && file_url !== null && file_url !== null ) {
        if (file_url.indexOf('?') > 0) {
            if (!DownloadOption.fileName){
                onErrorCallback("specialUrlError");
                return ;
            }
        }else{
            console.log("the url checking passed.");
        }
    }else{
        onErrorCallback("illlegalUrl");
        console.log("illlegal url.");
        return ;
    }

    var _this = this;
    //start download only if there is no this url.
    searchInformation(file_url,function(searchResult) {
        //url check
        if (searchResult !== undefined) {
            if(fs.existsSync(searchResult.destinationDir)){
                console.log(""+ searchResult.destinationDir +" is already in the indexedDB! ");
                onErrorCallback("fileExist");
                return;
            }else{
                console.log("the file was dismissed! Now to restart the download!");
                console.log(" "+ searchResult.destinationDir +" restart !");
            }
        };

        download_file_httpget(file_url);

        //the filewrite part
        if (!DownloadOption) {
            var DOWNLOAD_DIR = '/sdcard/downloads/';
            var file_name = url.parse(file_url).pathname.split('/').pop();
            console.log("the DownloadOption is undefined.");
        }else{
            console.log("the DownloadOption : " ,DownloadOption);
            if (!DownloadOption.storeDir) {
                var DOWNLOAD_DIR = '/sdcard/downloads/';
                console.log("the DownloadOption.storeDir is undefined.");
            }else{
                var DOWNLOAD_DIR = DownloadOption.storeDir;
            }
            //pop the filename
            if (!DownloadOption.fileName) {
                var file_name = url.parse(file_url).pathname.split('/').pop();
                console.log("the DownloadOption.fileName is undefined.");
            }else{
                var file_name = DownloadOption.fileName;
            }
        }

        //file option
        var optionsWrite = {
              flags : "w+",
              mode : 0666
        };


        var DestinationDir = DOWNLOAD_DIR + file_name;

        //mkdir for the downloadfile
        fs.mkdir(DOWNLOAD_DIR,function mkdir () {
            console.log("create directory sucess!");
        });

        //create the writeStream
        var file = fs.createWriteStream(DestinationDir,optionsWrite);

        if(!fs.existsSync(DestinationDir)){
            console.log("file create failed ,maybe the path you have no right to write.please change the destinationDir");
            onErrorCallback("CreataFileFailed.");
            return ;
        };

        hashSet[file_url]= http.get(options, function(res) {

            //check the url is illlegal or not
            if (res.statusCode == 404) {
                console.log("the res.status : " + res.statusCode );
                onErrorCallback("wrongUrl");
                return;
            };
            var content_length = res.headers['content-length'];
            ResponseSet[file_url] = res;
            //in case the max got 1 less.
            var currentSize = 0;
            var result= {
                msg : '',
                data : {
                    current : "",
                    max : content_length,
                    filePath : DestinationDir
                }
            };

            //add into the datebase
            if(searchResult == undefined){
                insertData({downloadurl: file_url, destinationDir: DestinationDir, maxSize: content_length,isFinished: false}); 
            }
            res.on('data', function(data) {
                console.log("the date size is :"+ parseInt(data.length));
                currentSize += parseInt(data.length);
                CurrentProgress[file_url] = currentSize;
                result.msg = "DOWNLOADING";
                result.data.current = JSON.stringify(currentSize);

                onProgressChange(result);
                file.write(data);

            }).on('end', function() {
                file.end();
                console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
                console.log("the res.status : " + res.statusCode  + "the content-length is :" +parseInt(content_length));

                //progress callback use the data.length to show the progress
                if (currentSize == content_length) {
                      result.msg = 'FINISHED';
                      updateData(file_url);
                }else{
                      result.msg = 'PAUSED';
                };
                result.data.current = JSON.stringify(currentSize);
                console.log("the result is : "+ JSON.stringify(result));
                onProgressChange(result);
            });

            res.on('error',function(e) {
                onErrorCallback(e);
                console.log('problem with request: ' + e.message);
            })
        }).on("error",function(e){
                onErrorCallback(e);
                console.log("the request got error : "+ e.message);
        });
    });
};

    //golable var
    window.DownloadManager= new DownloadManager();

})();