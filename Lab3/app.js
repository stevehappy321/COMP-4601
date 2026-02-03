
//Required module (install via NPM - npm install crawler)
//There are alternatives you could choose as well
import Crawler from "crawler";

const c = new Crawler({
    maxConnections : 10, //use this for parallel, rateLimit for individual
    //rateLimit: 1000,

    // This will be called for each crawled page
    callback : cb
});

let visitedURLs = new Set()

function cb(error, res, done) {
    if(error){
        console.log(error);
    }else{
        let $ = res.$; //get cheerio data, see cheerio docs for info
        let links = $("a") //get all links from page
        console.log($("a[href]"))
        $(links).each(function(i, link){
            //Log out links
            //In real crawler, do processing, decide if they need to be added to queue
            if (!visitedURLs.has($(link).attr('href'))) {
                visitedURLs.add($(link).attr('href'));
                c.add($(link).attr('href'));
                console.log($(link).text() + ':  ' + $(link).attr('href'));
            }
            
        });
    }
    done();
}

//Perhaps a useful event
//Triggered when the queue becomes empty
//There are some other events, check crawler docs
c.on('drain', function(){
    console.log("Done.");
});

//Queue a URL, which starts the crawl
c.add('https://people.scs.carleton.ca/~avamckenney/tinyfruits/N-0.html');
c.add('https://people.scs.carleton.ca/~avamckenney/fruits100/N-0.html');
c.add('https://people.scs.carleton.ca/~avamckenney/fruitsA/N-0.html');