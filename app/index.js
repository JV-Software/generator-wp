'use strict';

var util    = require('util'),
    path    = require('path'),
    exec    = require('child_process').exec,
    yeoman  = require('yeoman-generator'),
    ncp     = require('ncp').ncp,
    https   = require('https'),
    rimraf  = require('rimraf'),
    fs      = require('fs'),
    mysql   = require('mysql'),
    chalk   = require('chalk'),
    git     = require('../utils/git');

var WpGenerator = module.exports = function WpGenerator(args, options) {
    var self = this;

    yeoman.generators.Base.apply(this, arguments);

    this.on('end', function () {

        // Change directory to the starter theme's build folder
        process.chdir('wp-content/themes/' + this.wpThemeFolder + '/build');

        this.installDependencies({
            skipInstall: options['skip-install'],
            bower: false,
            callback: function () {

                self.log.info('Setting up starter theme');

                // Run default grunt task to generate initial theme files
                exec('grunt', function (err) {
                    if (err) {
                        self.log.error(err);
                    }

                    self.log.writeln('        ' + chalk.bold.green('✔ All done!'));
                });
            }
        });
    });

    this.pkg = JSON.parse(this.readFileAsString(path.join(__dirname, '../package.json')));
};

util.inherits(WpGenerator, yeoman.generators.Base);

// Get latest WP version
WpGenerator.prototype.getWpVersion = function getWpVersion() {
    var done = this.async(),
        self = this;

    git.getLatestTag('git://github.com/WordPress/WordPress.git', function (err, latestTag) {
        if (err) {
            self.log.error(err);
        }

        self.wpVersion = latestTag;

        done();
    });
};

// Prompt user for variable info
WpGenerator.prototype.askFor = function askFor() {
    var done = this.async();

    // Have Yeoman greet the user.
    console.log(this.yeoman);

    var prompts = [
        {
            name    : 'wpAuthor',
            message : 'Who\'s the theme author?',
            default : 'JV Software'
        },
        {
            name    : 'wpUrl',
            message : 'What\'s the author website?',
            default : 'http://www.jvsoftware.com/',
            validate : function (input) {
                var pass = input.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/);

                if (!pass) {
                    return 'Website must have a valid URL format';
                }

                return true;
            }
        },
        {
            name     : 'wpTheme',
            message  : 'What\'s the theme name?',
            validate : function (input) {
                if (!input) {
                    return 'Theme name can\'t be empty';
                }
                return true;
            }
        }
    ];

    this.prompt(prompts, function (props) {
        this.wpAuthor = props.wpAuthor;
        this.wpUrl    = props.wpUrl;
        this.wpTheme  = props.wpTheme;

        done();
    }.bind(this));
};

// Separate questions so theme folder can be slugified
WpGenerator.prototype.askForMore = function askForMore() {
    var done      = this.async(),
        themeSlug = this._.slugify(this.wpTheme);

    var prompts = [
        {
            name     : 'wpThemeFolder',
            message  : 'What\'s the theme folder name?',
            default  : themeSlug,
            validate : function (input) {
                if (!input) {
                    return 'Theme folder name can\'t be empty';
                }
                return true;
            }
        },
        {
            name     : 'dbName',
            message  : 'What\'s the database name?',
            default  : 'wp_' + themeSlug,
            validate : function (input) {
                if (!input) {
                    return 'Database name can\'t be empty';
                }
                return true;
            }
        },
        {
            name     : 'dbUser',
            message  : 'What\'s the database user?',
            default  : 'root',
            validate : function (input) {
                if (!input) {
                    return 'Database user can\'t be empty';
                }
                return true;
            }
        },
        {
            name     : 'dbPassword',
            message  : 'What\'s the database password?',
            default  : ''
        },
        {
            name     : 'dbHost',
            message  : 'What\'s the database host?',
            default  : 'localhost',
            validate : function (input) {
                if (!input) {
                    return 'Database host can\'t be empty';
                }
                return true;
            }
        },
        {
            name     : 'dbPrefix',
            message  : 'What\'s the database tables prefix?',
            default  : 'wp_',
            validate : function (input) {
                if (!input) {
                    return 'Database prefix can\'t be empty';
                }
                return true;
            }
        }
    ];

    this.wpThemeSlug = themeSlug;

    this.prompt(prompts, function (props) {
        this.wpThemeFolder = props.wpThemeFolder;
        this.dbName        = props.dbName;
        this.dbUser        = props.dbUser;
        this.dbPassword    = props.dbPassword;
        this.dbHost        = props.dbHost;
        this.dbPrefix      = props.dbPrefix;

        done();
    }.bind(this));
};

// Get selected WP version
WpGenerator.prototype.getWordpress = function getWordpress() {
    var done = this.async(),
        self = this;

    this.log.info('Getting WordPress v' + this.wpVersion);

    this.remote('WordPress', 'WordPress', this.wpVersion, function (err, remote) {
        if (err) {
            done(err);
        }

        self.log.info('Copying WordPress files');

        ncp(remote.cachePath, '.', function (err) {
            if (err) {
                return self.log.error(err);
            }

            done();
        });
    });
};

// Get salt keys
WpGenerator.prototype.getSaltKeys = function getSaltKeys() {
    var done = this.async(),
        self = this,
        keys = '';

    this.log.info('Getting auth keys');

    https.get('https://api.wordpress.org/secret-key/1.1/salt/', function (res) {
        res.on('data', function (d) {
            keys += d.toString();
        }).on('end', function () {
            self.authKeys = keys;
            done();
        });
    });
};

// Copy wp-config.php file
WpGenerator.prototype.copyWpConfig = function copyWpConfig() {
    var done = this.async();

    this.log.info('Creating wp-config.php file');

    this.template('_wp-config.php', 'wp-config.php');

    done();
};

// Remove hello dolly plugin
WpGenerator.prototype.rmHelloPlugin = function rmHelloPlugin() {
    var done = this.async(),
        self = this;

    rimraf('wp-content/plugins/hello.php', function () {
        self.log.writeln(chalk.red('   delete ') + 'hello.php plugin file');
        done();
    });
};

// Remove built-in themes
WpGenerator.prototype.rmThemes = function rmThemes() {
    var done = this.async(),
        self = this;

    fs.readdir('wp-content/themes', function (err, files) {
        if (typeof files !== 'undefined' && files.length !== 0) {
            files.forEach(function (file) {

                var pathFile     = fs.realpathSync('wp-content/themes/' + file),
                    isDirectory  = fs.statSync(pathFile).isDirectory();

                if (isDirectory) {
                    rimraf.sync(pathFile);
                    self.log.writeln(chalk.red('   delete ') + 'wp-content/themes/' + file);
                }
            });
        }

        done();
    });
};

// Get starter theme
WpGenerator.prototype.getStarterTheme = function getStarterTheme() {
    var done = this.async(),
        self = this;

    git.getLatestTag('git://github.com/JV-Software/Startup-WP-Theme.git', function (err, latestTag) {
        if (err) {
            self.log.error(err);
        }

        self.log.info('Getting starter theme');

        self.remote('JV-Software', 'Startup-WP-Theme', latestTag, function (err, remote) {
            if (err) {
                done(err);
            }

            self.log.info('Copying starter theme files');

            ncp(remote.cachePath, 'wp-content/themes/' + self.wpThemeFolder, function (err) {
                if (err) {
                    return self.log.error(err);
                }

                done();
            });
        });
    });
};

// Replace starter theme package.json file
WpGenerator.prototype.replacePackageJson = function replacePackageJson() {
    var done = this.async(),
        self = this;

    rimraf('wp-content/themes/' + this.wpThemeFolder + '/build/package.json', function () {
        self.log.info('Copying updated package.json file');

        self.template('_package.json', 'wp-content/themes/' + self.wpThemeFolder + '/build/package.json');

        done();
    });
};

// Create database if it doesn't exist
WpGenerator.prototype.createDb = function createDb() {
    var done = this.async(),
        self = this;

    var connection = mysql.createConnection({
        host     : this.dbHost,
        user     : this.dbUser,
        password : this.dbPassword
    });

    connection.connect(function (err) {
        if (err) {
            done(err);
        }

        self.log.info('Creating database if it doesn\'t exist');

        connection.query('CREATE DATABASE IF NOT EXISTS ' + mysql.escapeId(self.dbName), function (err) {
            if (err) {
                done(err);
            }

            connection.end(function () {
                done();
            });
        });
    });
};
