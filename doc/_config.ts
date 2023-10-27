import lume from "lume/mod.ts";
import code_highlight from "lume/plugins/code_highlight.ts";
import multilanguage from "lume/plugins/multilanguage.ts";
import prism from "lume/plugins/prism.ts";
import sitemap from "lume/plugins/sitemap.ts";
import vento from "lume/plugins/vento.ts";

const site = lume();

site.loadPages(['.html'])
site.copy(['.css', '.svg'])
site.data('layout', 'layout.vto')

site.use(code_highlight());
site.use(multilanguage());
site.use(prism({ cssSelector: 'pre' }));
site.use(sitemap());
site.use(vento());

export default site;
