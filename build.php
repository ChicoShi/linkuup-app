<?php
/**
 * You will need:
 * npm install uglify-js -g
 * npm install ng-annotate-patched -g
 */
use GDO\Net\HTTP;
use GDO\LinkUUp\Module_LinkUUp;
use GDO\Core\ModuleLoader;
use GDO\Core\Application;
use GDO\DB\Database;
use GDO\Util\FileUtil;

# Path
$srcpath = str_replace("\\", '/', __DIR__.'/');
$destpath = str_replace("\\", '/', __DIR__.'/app/');

unlink($destpath.'linkuup.temp.css');
unlink($destpath.'linkuup.merged.js');
unlink($destpath.'linkuup.annotated.js');

# Patch build number
$file = file_get_contents('config/lup-php-config.php');
$file = preg_replace_callback('/\\$VERSION *= *(\\d+)/', function($matches) {
	$build = $matches[1] + 1;
	echo "Increasing build number to $build.\n";
	return '$VERSION = ' . $build;
}, $file);
file_put_contents('config/lup-php-config.php', $file);

# Include GDO
require 'config/lup-php-config.php';
chdir(LUPConfig::$GDO_PATH);
require 'GDO7.php';
require 'protected/config.php';
$v = LUPConfig::$VERSION;
global $me;
$me = \GDO\Core\Method\Stub::make();

function protect(string $dir)
{
    $content = <<< EOF
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Deny from all
</IfModule>
EOF;
    file_put_contents("$dir/.htaccess", $content);
}

# Load GDO
final class Builder extends Application
{
	public function isCLI() : bool { return true; }
}
$app = Builder::init();
Database::init();
$loader = ModuleLoader::instance();
$loader->loadModulesCache();
$loader->initModules();

# Load page
$url = Module_LinkUUp::instance()->cfgAppUrl() . 'index_debug.php';
$page = HTTP::getFromURL($url);
$page = str_replace("\r", "", $page);
$lines = explode("\n", $page);

# Minify
$output = '';
$javascripts = [];
$css = [];
echo "Parsing index_debug.php\n";
foreach ($lines as $line)
{
	$match = '';
	if (preg_match("/script.*src=\"([^?\"]+)/", $line, $match))
	{
		$javascripts[] = $match[1];
		continue;
	}
	
	if (preg_match("/stylesheet.*href=\"([^?\"]+)/", $line, $match))
	{
		if ((strpos($match[1], "bower") === false) &&
			(!str_starts_with($match[1], 'http')) )
		{
			$css[] = $match[1];
			continue;
		}
	}

	if (trim($line))
	{
		$output .= $line . "\n";
	}
}

FileUtil::createDir($destpath);

# Merge CSS
$cssmerge = '';
foreach ($css as $file)
{
	$cssmerge .= file_get_contents($srcpath.$file);
}
file_put_contents($destpath.'linkuup.temp.css', $cssmerge);
echo "Running clean-css on CSS file...\n";
$status = 0;
system("cleancss -O2 -o \"{$destpath}linkuup.css\" \"{$destpath}linkuup.temp.css\"", $status);
if ($status !== 0)
{
	throw new RuntimeException('CSS bundling failed.');
}

// # Hook Merged css into index
$output = str_replace("</head>", "  <link rel=\"stylesheet\" href=\"app/linkuup.css?v={$v}\" />\n</head>", $output);

# Merge JS
echo "Merging javascript files\n";
$jsmerge = '';
foreach ($javascripts as $file)
{
	$jsmerge .= file_get_contents($srcpath.$file);
	$jsmerge .= "\n";
}
file_put_contents($destpath.'linkuup.merged.js', $jsmerge);

# Minify
chdir($destpath);
$annotate = 'node ' . escapeshellarg($srcpath . 'tools/ng-annotate-wrapper.js') .
	' ' . escapeshellarg($destpath . 'linkuup.merged.js') .
	' ' . escapeshellarg($destpath . 'linkuup.annotated.js');
echo "$annotate\n";
system($annotate);

$uglify = "uglifyjs -c drop_console=true --mangle -o linkuup.js linkuup.annotated.js";
echo "$uglify\n";
system($uglify);

# Hook JS into index
$output = str_replace("</body>", "  <script type=\"text/javascript\" src=\"app/linkuup.js?v={$v}\"></script>\n</body>", $output);

# Write new index
file_put_contents($srcpath.'index.php', $output);

# Clean and protect against sniffers
unlink('linkuup.temp.css');
unlink('linkuup.merged.js');
unlink('linkuup.annotated.js');
// Angular loads HTML templates from js/pages at runtime. Do not deny this
// directory after bundling: that would also deny the application's views.
protect("{$srcpath}css");
protect("{$srcpath}config");

echo "==== DONE ====\n";
echo $output;
