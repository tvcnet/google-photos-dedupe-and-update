<?php
/**
 * Prevent direct access to this file
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/*
Plugin Name: The Hack Repair Guy's Smart Embed
Plugin URI: https://hackrepair.com/hackrepair-smart-embed
Description: Create reusable, safe Smart Embeds and drop them anywhere with a shortcode. Add responsive wrappers, max‑width, and custom classes. Optional URL embeds load approved HTTPS scripts (defer). Non‑public CPT; lightweight, fast, clean, and Gutenberg‑friendly.
Author: Jim Walker, The Hack Repair Guy
Version: 2.4.4
Author URI: https://hackrepair.com/about/hackrepair-smart-embed
Text Domain: hackrepair-smart-embed
Domain Path: /languages
*/

add_action( 'init', array( 'HackRepair_Smart_Embed', 'init' ) );
register_activation_hook( __FILE__, array( 'HackRepair_Smart_Embed', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'HackRepair_Smart_Embed', 'deactivate' ) );

class HackRepair_Smart_Embed {

    public static function init() {

        // Load translations
        load_plugin_textdomain( 'hackrepair-smart-embed', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );

        // Register custom post type for Smart Embeds (new slug and post type key)
        self::register_cpt();

        // Register settings used by the Settings page
        add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );

        // Admin columns to show shortcode examples
        add_filter( 'manage_edit-smart-embed_columns', array( __CLASS__, 'add_shortcode_column' ) );
        add_action( 'manage_smart-embed_posts_custom_column', array( __CLASS__, 'add_shortcode_column_content' ), 10, 2 );

        // Meta box for per-embed settings
        add_action( 'add_meta_boxes', array( __CLASS__, 'register_meta_box' ) );
        add_action( 'save_post', array( __CLASS__, 'save_meta_box' ), 10, 2 );

        // Front-end assets
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
        // Admin assets (list table copy buttons)
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'admin_assets' ) );

        // Plugin row meta & action links
        add_filter( 'plugin_row_meta', array( __CLASS__, 'plugin_row_meta' ), 10, 2 );
        add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( __CLASS__, 'plugin_action_links' ), 10, 1 );

        // Admin menu
        add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ), 100 );
        // Rename the default CPT list submenu label
        add_action( 'admin_menu', array( __CLASS__, 'rename_cpt_submenu' ), 200 );

        // Shortcode to render the block (primary)
        add_shortcode( 'smart_embed', array( __CLASS__, 'shortcode' ) );
    }

    public static function register_settings() {
        register_setting(
            'hrgse_settings_group',
            'hrgse_delete_on_deactivate',
            array(
                'type'              => 'boolean',
                'sanitize_callback' => array( __CLASS__, 'sanitize_checkbox' ),
                'default'           => 0,
            )
        );

        register_setting(
            'hrgse_settings_group',
            'hrgse_enable_url_embeds',
            array(
                'type'              => 'boolean',
                'sanitize_callback' => array( __CLASS__, 'sanitize_checkbox' ),
                'default'           => 0,
            )
        );

        register_setting(
            'hrgse_settings_group',
            'hrgse_allowed_domains',
            array(
                'type'              => 'string',
                'sanitize_callback' => array( __CLASS__, 'sanitize_allowed_domains' ),
                'default'           => '',
            )
        );
    }

    public static function register_cpt() {
        $labels = array(
            'name'               => _x( 'Smart Embeds', 'post type general name', 'hackrepair-smart-embed' ),
            'singular_name'      => _x( 'Smart Embed', 'post type singular name', 'hackrepair-smart-embed' ),
            'add_new'            => _x( 'Add New', 'Smart Embed', 'hackrepair-smart-embed' ),
            'add_new_item'       => __( 'Add New Smart Embed', 'hackrepair-smart-embed' ),
            'edit_item'          => __( 'Edit Smart Embed', 'hackrepair-smart-embed' ),
            'new_item'           => __( 'New Smart Embed', 'hackrepair-smart-embed' ),
            'view_item'          => __( 'View Smart Embed', 'hackrepair-smart-embed' ),
            'search_items'       => __( 'Search Smart Embeds', 'hackrepair-smart-embed' ),
            'not_found'          => __( 'No Smart Embeds found', 'hackrepair-smart-embed' ),
            'not_found_in_trash' => __( 'No Smart Embeds found in Trash', 'hackrepair-smart-embed' ),
            'parent_item_colon'  => '',
            'menu_name'          => __( 'Smart Embeds', 'hackrepair-smart-embed' ),
        );

        $args = array(
            'labels'              => $labels,
            'public'              => false,              // Non-public
            'publicly_queryable'  => false,              // Not queryable on the front end
            'show_ui'             => true,               // Manage via admin UI
            // Show CPT in sidebar menu (top-level)
            'show_in_menu'        => true,
            'show_in_nav_menus'   => false,
            'query_var'           => false,              // No public query var
            'capability_type'     => 'post',
            'has_archive'         => false,
            'hierarchical'        => false,
            'menu_position'       => null,
            'menu_icon'           => 'dashicons-shortcode',
            'exclude_from_search' => true,
            'show_in_rest'        => true,               // Keep block editor support
            'supports'            => array( 'title', 'editor' ),
            'rewrite'             => false,              // No permalinks for singles
        );

        register_post_type( 'smart-embed', $args );
    }

    public static function add_shortcode_column( $columns ) {
        $columns['smart_embed_shortcode'] = __( 'Smart Embed Shortcode', 'hackrepair-smart-embed' );
        return $columns;
    }

    public static function add_shortcode_column_content( $column, $post_id ) {
        if ( 'smart_embed_shortcode' !== $column ) {
            return;
        }
        $post = get_post( $post_id );
        $slug = $post ? $post->post_name : '';
        if ( $post && '' === $slug ) {
            $slug = (string) $post_id;
        }
        $sc_id   = '[smart_embed id="' . $post_id . '"]';
        $sc_slug = '[smart_embed slug="' . $slug . '"]';

        echo '<div class="hrgse-shortcodes">';
        echo '<code>' . esc_html( $sc_id ) . '</code> ';
        echo '<button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $sc_id ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button>';
        echo '<br />';
        echo '<code>' . esc_html( $sc_slug ) . '</code> ';
        echo '<button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $sc_slug ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button>';
        echo '</div>';
    }

    public static function shortcode( $attrs, $content = null ) {
        $output = '';
        $attrs  = shortcode_atts( array(
            'id'         => '',
            'slug'       => '',
            'responsive' => '',
            'max_width'  => '',
            'class'      => '',
        ), $attrs );

        $id   = isset( $attrs['id'] ) ? absint( $attrs['id'] ) : 0;
        $slug = isset( $attrs['slug'] ) ? sanitize_title( $attrs['slug'] ) : '';
        $post = null;

        if ( $id ) {
            $post = get_post( $id );
        } elseif ( $slug ) {
            $args = array(
                'name'        => $slug,
                'post_type'   => 'smart-embed',
                'post_status' => 'publish',
                'numberposts' => 1,
            );
            $result = get_posts( $args );
            if ( $result ) {
                $post = $result[0];
            }
        }

        // Ensure we only render published Smart Embeds
        if ( ! $post || 'smart-embed' !== $post->post_type || 'publish' !== $post->post_status ) {
            return '';
        }

        $content_html = $post->post_content;

        // Fetch saved meta.
        $saved_responsive   = get_post_meta( $post->ID, '_hrgse_responsive', true );
        $saved_max_width    = get_post_meta( $post->ID, '_hrgse_max_width', true );
        $saved_wrapper_class= get_post_meta( $post->ID, '_hrgse_wrapper_class', true );
        $script_url         = get_post_meta( $post->ID, '_hrgse_script_url', true );
        $canvas_enable      = get_post_meta( $post->ID, '_hrgse_canvas_enable', true );
        $canvas_id          = get_post_meta( $post->ID, '_hrgse_canvas_id', true );
        $canvas_w           = intval( get_post_meta( $post->ID, '_hrgse_canvas_width', true ) );
        $canvas_h           = intval( get_post_meta( $post->ID, '_hrgse_canvas_height', true ) );
        $canvas_fullwidth   = get_post_meta( $post->ID, '_hrgse_canvas_fullwidth', true );

        // Determine effective values with shortcode overrides.
        $responsive = '' !== $attrs['responsive'] ? self::to_bool( $attrs['responsive'] ) : ( '1' === $saved_responsive );
        if ( '1' === (string) $canvas_enable ) {
            $responsive = false; // avoid video-style wrapper for canvas
        }
        $max_width  = '' !== $attrs['max_width'] ? intval( $attrs['max_width'] ) : intval( $saved_max_width );
        $classes    = trim( $saved_wrapper_class . ' ' . $attrs['class'] );
        $classes    = self::sanitize_class_list( $classes );

        // Prepend canvas placeholder if requested.
        if ( '1' === (string) $canvas_enable ) {
            $cid = $canvas_id ? self::sanitize_html_id_attr( $canvas_id ) : 'animationCanvas';
            $cw  = $canvas_w > 0 ? $canvas_w : 600;
            $ch  = $canvas_h > 0 ? $canvas_h : 400;
            $style = ( '1' === (string) $canvas_fullwidth ) ? ' style="width:100%;height:' . intval( $ch ) . 'px;"' : '';
            $canvas_markup = '<canvas id="' . esc_attr( $cid ) . '" width="' . intval( $cw ) . '" height="' . intval( $ch ) . '"' . $style . '></canvas>';
            $content_html  = $canvas_markup . $content_html;
        }

        // Enqueue external script if allowed; otherwise, capture an admin-only debug comment (not visible to visitors).
        $debug_comment = '';
        if ( $script_url ) {
            $reason = '';
            if ( ! self::url_embeds_enabled() ) {
                $reason = 'URL embeds disabled in Settings';
            } else {
                $u = wp_parse_url( $script_url );
                if ( ! is_array( $u ) ) {
                    $reason = 'Invalid URL';
                } elseif ( empty( $u['scheme'] ) || 'https' !== strtolower( $u['scheme'] ) ) {
                    $reason = 'Non-HTTPS URL';
                } elseif ( empty( $u['host'] ) ) {
                    $reason = 'Missing host';
                } else {
                    $host    = strtolower( $u['host'] );
                    $allowed = self::get_allowed_domains();
                    if ( empty( $allowed ) ) {
                        $reason = 'No allowed domains configured';
                    } elseif ( ! self::is_host_allowed( $host, $allowed ) ) {
                        $reason = 'Host not in allowlist: ' . $host;
                    }
                }
            }
            if ( '' === $reason ) {
                self::enqueue_external_script( $script_url );
            } elseif ( current_user_can( 'manage_options' ) ) {
                $debug_comment = '<!-- Smart Embed: external script not enqueued: ' . esc_html( $reason ) . ' -->';
            }
        }

        // Iframe HTML URL embedding removed; only script URL enqueue is supported.

        // Build wrapper attributes.
        $wrapper_attrs = '';
        $wrapper_classes = 'hrgse-embed';
        if ( $classes ) {
            $wrapper_classes .= ' ' . $classes; // already sanitized via sanitize_class_list
        }
        $wrapper_attrs .= ' class="' . esc_attr( $wrapper_classes ) . '"';
        $wrapper_attrs .= ' data-hrgse-id="' . intval( $post->ID ) . '" data-hrgse-slug="' . esc_attr( $post->post_name ) . '"';
        if ( $max_width > 0 ) {
            $wrapper_attrs .= ' style="' . esc_attr( 'max-width:' . intval( $max_width ) . 'px;width:100%;' ) . '"';
        }

        // Build output.
        if ( $responsive ) {
            $output  = '<div' . $wrapper_attrs . '>';
            $output .= '<div class="hrgse-responsive">' . $content_html . '</div>';
            $output .= '</div>';
        } else {
            $output  = '<div' . $wrapper_attrs . '>' . $content_html . '</div>';
        }

        if ( $debug_comment ) {
            $output .= "\n" . $debug_comment;
        }

        return $output;
    }

    public static function register_meta_box() {
        add_meta_box(
            'hrgse_settings',
            __( 'Smart Embed Settings', 'hackrepair-smart-embed' ),
            array( __CLASS__, 'render_meta_box' ),
            'smart-embed',
            'side',
            'default'
        );
    }

    public static function render_meta_box( $post ) {
        wp_nonce_field( 'hrgse_save_meta', 'hrgse_meta_nonce' );
        // Shortcode quick-copy at top
        $slug = isset( $post->post_name ) ? $post->post_name : '';
        if ( '' === $slug ) {
            $slug = (string) $post->ID;
        }
        $sc_id   = '[smart_embed id="' . intval( $post->ID ) . '"]';
        $sc_slug = $slug ? '[smart_embed slug="' . esc_attr( $slug ) . '"]' : '';
        echo '<p><strong>' . esc_html__( 'Shortcode', 'hackrepair-smart-embed' ) . '</strong><br />';
        echo '<code>' . esc_html( $sc_id ) . '</code> ';
        echo '<button type="button" class="button button-small hrgse-copy" data-clip="' . esc_attr( $sc_id ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button>';
        if ( $sc_slug ) {
            echo '<br /><code>' . esc_html( $sc_slug ) . '</code> ';
            echo '<button type="button" class="button button-small hrgse-copy" data-clip="' . esc_attr( $sc_slug ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button>';
        }
        echo '</p>';
        $responsive    = get_post_meta( $post->ID, '_hrgse_responsive', true );
        $max_width     = get_post_meta( $post->ID, '_hrgse_max_width', true );
        $wrapper_class = get_post_meta( $post->ID, '_hrgse_wrapper_class', true );
        $script_url    = get_post_meta( $post->ID, '_hrgse_script_url', true );
        $canvas_enable    = get_post_meta( $post->ID, '_hrgse_canvas_enable', true );
        $canvas_id        = get_post_meta( $post->ID, '_hrgse_canvas_id', true );
        $canvas_w         = get_post_meta( $post->ID, '_hrgse_canvas_width', true );
        $canvas_h         = get_post_meta( $post->ID, '_hrgse_canvas_height', true );
        $canvas_fullwidth = get_post_meta( $post->ID, '_hrgse_canvas_fullwidth', true );
        ?>
        <p>
            <label for="hrgse_editor_toggle"><strong><?php esc_html_e( 'Editor Mode', 'hackrepair-smart-embed' ); ?></strong></label><br />
            <label class="hrgse-switch">
                <input type="checkbox" id="hrgse_editor_toggle" />
                <span class="hrgse-slider"><span class="hrgse-slider-text" id="hrgse-editor-toggle-label">ON</span></span>
            </label>
            <span class="description"><?php esc_html_e( 'Enable Visual Mode', 'hackrepair-smart-embed' ); ?></span>
        </p>
        <p>
            <label>
                <input type="checkbox" name="hrgse_responsive" value="1" <?php checked( '1', $responsive ); ?> />
                <?php esc_html_e( 'Responsive wrapper', 'hackrepair-smart-embed' ); ?>
            </label>
        </p>
        <p>
            <label for="hrgse_max_width"><strong><?php esc_html_e( 'Max Width (px)', 'hackrepair-smart-embed' ); ?></strong></label><br />
            <input type="number" min="0" step="1" name="hrgse_max_width" id="hrgse_max_width" value="<?php echo esc_attr( $max_width ); ?>" placeholder="e.g. 800" />
        </p>
        <p>
            <label for="hrgse_wrapper_class"><strong><?php esc_html_e( 'Wrapper CSS class', 'hackrepair-smart-embed' ); ?></strong></label><br />
            <input type="text" name="hrgse_wrapper_class" id="hrgse_wrapper_class" value="<?php echo esc_attr( $wrapper_class ); ?>" placeholder="optional class names" />
        </p>
        <hr />
        <p>
            <label for="hrgse_script_url"><strong><?php esc_html_e( 'External Script URL (optional)', 'hackrepair-smart-embed' ); ?></strong></label><br />
            <input type="url" style="width:100%" name="hrgse_script_url" id="hrgse_script_url" value="<?php echo esc_attr( $script_url ); ?>" placeholder="https://cdn.example.com/widget.js" />
            <span class="description"><?php esc_html_e( 'Must Be Enabled in Settings: The URL will load with defer, use HTTPS only, and be restricted to approved domains.', 'hackrepair-smart-embed' ); ?></span>
        </p>
        <p>
            <label><input type="checkbox" name="hrgse_canvas_enable" value="1" <?php checked( '1', $canvas_enable ); ?> /> <strong><?php esc_html_e( 'Insert canvas placeholder', 'hackrepair-smart-embed' ); ?></strong></label><br />
            <label for="hrgse_canvas_id"><?php esc_html_e( 'Canvas ID', 'hackrepair-smart-embed' ); ?></label>
            <input type="text" name="hrgse_canvas_id" id="hrgse_canvas_id" value="<?php echo esc_attr( $canvas_id ); ?>" placeholder="animationCanvas" style="width:100%" />
            <span class="description"><?php esc_html_e( 'Tip: For canvas, leave Responsive wrapper off or set a fixed height in CSS.', 'hackrepair-smart-embed' ); ?></span><br />
            <label for="hrgse_canvas_width"><?php esc_html_e( 'Canvas width (px)', 'hackrepair-smart-embed' ); ?></label>
            <input type="number" min="1" step="1" name="hrgse_canvas_width" id="hrgse_canvas_width" value="<?php echo esc_attr( $canvas_w ); ?>" placeholder="600" style="width:100%" />
            <label for="hrgse_canvas_height"><?php esc_html_e( 'Canvas height (px)', 'hackrepair-smart-embed' ); ?></label>
            <input type="number" min="1" step="1" name="hrgse_canvas_height" id="hrgse_canvas_height" value="<?php echo esc_attr( $canvas_h ); ?>" placeholder="400" style="width:100%" />
            <br />
            <label><input type="checkbox" name="hrgse_canvas_fullwidth" value="1" <?php checked( '1', $canvas_fullwidth ); ?> /> <?php esc_html_e( 'For full width (sets CSS width:100%)', 'hackrepair-smart-embed' ); ?></label>
        </p>
        
        <?php
    }

    public static function save_meta_box( $post_id, $post ) {
        if ( 'smart-embed' !== get_post_type( $post ) ) {
            return;
        }
        if ( ! isset( $_POST['hrgse_meta_nonce'] ) || ! wp_verify_nonce( $_POST['hrgse_meta_nonce'], 'hrgse_save_meta' ) ) {
            return;
        }
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        // Responsive toggle.
        if ( isset( $_POST['hrgse_responsive'] ) && '1' === $_POST['hrgse_responsive'] ) {
            update_post_meta( $post_id, '_hrgse_responsive', '1' );
        } else {
            delete_post_meta( $post_id, '_hrgse_responsive' );
        }

        // Max width.
        $max_width = isset( $_POST['hrgse_max_width'] ) ? intval( $_POST['hrgse_max_width'] ) : 0;
        if ( $max_width > 0 ) {
            update_post_meta( $post_id, '_hrgse_max_width', $max_width );
        } else {
            delete_post_meta( $post_id, '_hrgse_max_width' );
        }

        // Wrapper class list.
        $class_raw = isset( $_POST['hrgse_wrapper_class'] ) ? wp_unslash( $_POST['hrgse_wrapper_class'] ) : '';
        $class_sanitized = self::sanitize_class_list( $class_raw );
        if ( $class_sanitized ) {
            update_post_meta( $post_id, '_hrgse_wrapper_class', $class_sanitized );
        } else {
            delete_post_meta( $post_id, '_hrgse_wrapper_class' );
        }

        // External script URL (optional)
        $script_url_raw = isset( $_POST['hrgse_script_url'] ) ? wp_unslash( $_POST['hrgse_script_url'] ) : '';
        $script_url     = esc_url_raw( $script_url_raw );
        if ( $script_url ) {
            update_post_meta( $post_id, '_hrgse_script_url', $script_url );
        } else {
            delete_post_meta( $post_id, '_hrgse_script_url' );
        }

        // Canvas placeholder options
        if ( isset( $_POST['hrgse_canvas_enable'] ) && '1' === $_POST['hrgse_canvas_enable'] ) {
            update_post_meta( $post_id, '_hrgse_canvas_enable', '1' );
        } else {
            delete_post_meta( $post_id, '_hrgse_canvas_enable' );
        }
        $canvas_id_raw = isset( $_POST['hrgse_canvas_id'] ) ? wp_unslash( $_POST['hrgse_canvas_id'] ) : '';
        $canvas_id_s   = self::sanitize_html_id_attr( $canvas_id_raw );
        if ( $canvas_id_s ) {
            update_post_meta( $post_id, '_hrgse_canvas_id', $canvas_id_s );
        } else {
            delete_post_meta( $post_id, '_hrgse_canvas_id' );
        }
        // Only save width/height if provided; otherwise remove so defaults apply.
        if ( isset( $_POST['hrgse_canvas_width'] ) ) {
            $canvas_w_raw = trim( (string) wp_unslash( $_POST['hrgse_canvas_width'] ) );
            if ( '' !== $canvas_w_raw ) {
                $canvas_w = max( 1, intval( $canvas_w_raw ) );
                update_post_meta( $post_id, '_hrgse_canvas_width', $canvas_w );
            } else {
                delete_post_meta( $post_id, '_hrgse_canvas_width' );
            }
        }
        if ( isset( $_POST['hrgse_canvas_height'] ) ) {
            $canvas_h_raw = trim( (string) wp_unslash( $_POST['hrgse_canvas_height'] ) );
            if ( '' !== $canvas_h_raw ) {
                $canvas_h = max( 1, intval( $canvas_h_raw ) );
                update_post_meta( $post_id, '_hrgse_canvas_height', $canvas_h );
            } else {
                delete_post_meta( $post_id, '_hrgse_canvas_height' );
            }
        }

        if ( isset( $_POST['hrgse_canvas_fullwidth'] ) && '1' === $_POST['hrgse_canvas_fullwidth'] ) {
            update_post_meta( $post_id, '_hrgse_canvas_fullwidth', '1' );
        } else {
            delete_post_meta( $post_id, '_hrgse_canvas_fullwidth' );
        }

        // Iframe URL option removed (JavaScript URLs only)

        // Auto-generate slug equal to ID if missing
        $p = get_post( $post_id );
        if ( $p && '' === (string) $p->post_name ) {
            $base   = (string) $post_id;
            $unique = wp_unique_post_slug( $base, $post_id, $p->post_status, $p->post_type, $p->post_parent );
            remove_action( 'save_post', array( __CLASS__, 'save_meta_box' ), 10 );
            wp_update_post( array( 'ID' => $post_id, 'post_name' => $unique ) );
            add_action( 'save_post', array( __CLASS__, 'save_meta_box' ), 10, 2 );
        }
    }

    public static function enqueue_assets() {
        wp_register_style( 'hrgse-smart-embed', plugins_url( 'css/smart-embed.css', __FILE__ ), array(), '2.4.4' );
        wp_enqueue_style( 'hrgse-smart-embed' );
    }

    public static function admin_assets( $hook ) {
        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
        $is_list_screen        = ( $screen && 'edit-smart-embed' === $screen->id );
        $is_settings_page      = ( $screen && 'smart-embed_page_hackrepair-smart-embed' === $screen->id );
        $is_editor_screen      = ( $screen && isset( $screen->post_type ) && 'smart-embed' === $screen->post_type && 'post' === $screen->base );

        // Copy button JS for list screens (native and inline)
        if ( $is_list_screen ) {
            wp_register_script( 'hrgse-admin', plugins_url( 'js/admin.js', __FILE__ ), array( 'jquery' ), '2.4.4', true );
            wp_enqueue_script( 'hrgse-admin' );
            wp_localize_script( 'hrgse-admin', 'hrgse_i18n', array(
                'copied' => __( 'Copied!', 'hackrepair-smart-embed' ),
                'copy'   => __( 'Copy', 'hackrepair-smart-embed' ),
            ) );
        }

        // Settings page examples toggle
        if ( $is_settings_page ) {
            wp_register_script( 'hrgse-settings', plugins_url( 'js/settings.js', __FILE__ ), array( 'jquery' ), '2.4.4', true );
            wp_enqueue_script( 'hrgse-settings' );
            wp_localize_script( 'hrgse-settings', 'hrgse_settings_i18n', array(
                'show' => __( 'Show examples', 'hackrepair-smart-embed' ),
                'hide' => __( 'Hide examples', 'hackrepair-smart-embed' ),
            ) );
        }

        // Editor toggle JS/CSS for Smart Embed edit screens
        if ( $is_editor_screen ) {
            wp_register_style( 'hrgse-admin-css', plugins_url( 'css/admin.css', __FILE__ ), array(), '2.4.4' );
            wp_enqueue_style( 'hrgse-admin-css' );
            // Enable copy buttons in the editor metabox
            wp_register_script( 'hrgse-admin', plugins_url( 'js/admin.js', __FILE__ ), array( 'jquery' ), '2.4.4', true );
            wp_enqueue_script( 'hrgse-admin' );
            wp_localize_script( 'hrgse-admin', 'hrgse_i18n', array(
                'copied' => __( 'Copied!', 'hackrepair-smart-embed' ),
                'copy'   => __( 'Copy', 'hackrepair-smart-embed' ),
            ) );
            wp_register_script( 'hrgse-editor', plugins_url( 'js/editor-toggle.js', __FILE__ ), array( 'wp-data', 'wp-edit-post', 'jquery' ), '2.4.4', true );
            wp_enqueue_script( 'hrgse-editor' );
            wp_localize_script( 'hrgse-editor', 'hrgse_editor_i18n', array(
                'mode_visual'      => __( 'Visual', 'hackrepair-smart-embed' ),
                'mode_code'        => __( 'Code', 'hackrepair-smart-embed' ),
                'switch_to_code'   => __( 'Switch to Code Editor', 'hackrepair-smart-embed' ),
                'switch_to_visual' => __( 'Switch to Visual Editor', 'hackrepair-smart-embed' ),
                'default_to_code'  => true, // Default new Smart Embeds to Code editor
            ) );
        }
    }

    public static function plugin_row_meta( $links, $file ) {
        if ( $file !== plugin_basename( __FILE__ ) ) {
            return $links;
        }
        $meta_links = array(
            '<a href="https://hackrepair.com/hackrepair-smart-embed" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Docs', 'hackrepair-smart-embed' ) . '</a>',
            '<a href="https://hackrepair.com/contact/" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Support', 'hackrepair-smart-embed' ) . '</a>',
            '<a href="https://hackrepair.com/donations/buy-jim-a-coffee" target="_blank" rel="noopener noreferrer">' . esc_html__( 'Donate', 'hackrepair-smart-embed' ) . '</a>',
        );
        return array_merge( $links, $meta_links );
    }

    public static function plugin_action_links( $links ) {
        // Only show Settings (Docs removed per request).
        $settings_link = '<a href="' . esc_url( admin_url( 'edit.php?post_type=smart-embed&page=hackrepair-smart-embed' ) ) . '">' . esc_html__( 'Settings', 'hackrepair-smart-embed' ) . '</a>';
        array_unshift( $links, $settings_link );
        return $links;
    }

    public static function admin_menu() {
        // Add Settings as a submenu under the Smart Embeds CPT menu
        add_submenu_page(
            'edit.php?post_type=smart-embed',
            __( "The Hack Repair Guy's Smart Embed: Settings", 'hackrepair-smart-embed' ),
            __( 'Settings', 'hackrepair-smart-embed' ),
            'manage_options',
            'hackrepair-smart-embed',
            array( __CLASS__, 'settings_page' )
        );
    }

    public static function rename_cpt_submenu() {
        // Rename the default CPT list submenu from "Smart Embeds" to "List Smart Embeds"
        global $submenu;
        $parent = 'edit.php?post_type=smart-embed';
        if ( isset( $submenu[ $parent ] ) && is_array( $submenu[ $parent ] ) ) {
            foreach ( $submenu[ $parent ] as $i => $item ) {
                // 0 => title, 2 => slug
                if ( isset( $item[2] ) && $item[2] === $parent ) {
                    $submenu[ $parent ][ $i ][0] = __( 'List Smart Embeds', 'hackrepair-smart-embed' );
                    break;
                }
            }
        }
    }

    public static function settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have sufficient permissions to access this page.', 'hackrepair-smart-embed' ) );
        }
        $current_tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : 'settings';
        // Back-compat: if an old link uses tab=list, redirect to native CPT list
        if ( 'list' === $current_tab ) {
            wp_safe_redirect( admin_url( 'edit.php?post_type=smart-embed' ) );
            exit;
        }
        $base_url    = admin_url( 'edit.php?post_type=smart-embed&page=hackrepair-smart-embed' );
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( "The Hack Repair Guy's Smart Embed: Settings", 'hackrepair-smart-embed' ) . '</h1>';
        echo '<h2 class="nav-tab-wrapper">';
        printf(
            '<a href="%s" class="nav-tab %s">%s</a>',
            esc_url( $base_url ),
            ( 'settings' === $current_tab ? 'nav-tab-active' : '' ),
            esc_html__( 'Settings', 'hackrepair-smart-embed' )
        );
        printf(
            '<a href="%s" class="nav-tab">%s</a>',
            esc_url( admin_url( 'edit.php?post_type=smart-embed' ) ),
            esc_html__( 'Smart Embeds', 'hackrepair-smart-embed' )
        );
        printf(
            '<a href="%s" class="nav-tab %s">%s</a>',
            esc_url( add_query_arg( 'tab', 'notes', $base_url ) ),
            ( 'notes' === $current_tab ? 'nav-tab-active' : '' ),
            esc_html__( 'Author Notes', 'hackrepair-smart-embed' )
        );
        echo '</h2>';

        if ( 'notes' === $current_tab ) {
            echo '<div style="max-width: 720px;">';
            $notes = plugin_dir_path( __FILE__ ) . 'includes/notes.php';
            if ( file_exists( $notes ) ) {
                include $notes;
            } else {
                echo '<p>' . esc_html__( 'Notes file not found.', 'hackrepair-smart-embed' ) . '</p>';
            }
            echo '</div>';
        } else {
            echo '<div style="max-width: 900px;">';
            $settings_inc = plugin_dir_path( __FILE__ ) . 'includes/settings.php';
            if ( file_exists( $settings_inc ) ) { include $settings_inc; }
            if ( false ) {
            echo '<p>' . esc_html__( 'Smart Embed lets you create a reusable chunk of HTML (like a video iframe, form, or widget) and drop it anywhere using a shortcode.', 'hackrepair-smart-embed' ) . '</p>';

            echo '<h3>' . esc_html__( 'Shortcodes', 'hackrepair-smart-embed' ) . '</h3>';
            $sc1 = '[smart_embed id="123"]';
            $sc2 = '[smart_embed slug="my-embed"]';
            echo '<p><code>' . esc_html( $sc1 ) . '</code> &nbsp; <code>' . esc_html( $sc2 ) . '</code></p>';

            echo '<h3>' . esc_html__( 'Optional attributes', 'hackrepair-smart-embed' ) . '</h3>';
            $attr1 = 'responsive="true|false"';
            $attr2 = 'max_width="800"';
            $attr3 = 'class="my-wrapper"';
            echo '<p><code>' . esc_html( $attr1 ) . '</code> &nbsp; <code>' . esc_html( $attr2 ) . '</code> &nbsp; <code>' . esc_html( $attr3 ) . '</code></p>';
            echo '<p class="description">' . esc_html__( 'You can set these options in the Smart Embed editor (sidebar). If you also include them in a shortcode, the shortcode values override the saved settings for that instance only.', 'hackrepair-smart-embed' ) . '</p>';

            // Examples toggle
            echo '<p><a href="#" id="hrgse-examples-toggle" class="button-link">' . esc_html__( 'Show examples', 'hackrepair-smart-embed' ) . '</a></p>';
            echo '<div id="hrgse-examples" style="display:none; margin-top:10px;">';
            echo '<h3>' . esc_html__( 'Examples', 'hackrepair-smart-embed' ) . '</h3>';
            echo '<table class="widefat striped" style="margin-top:10px;">';
            echo '<thead><tr><th>' . esc_html__( 'Use case', 'hackrepair-smart-embed' ) . '</th><th>' . esc_html__( 'Shortcode', 'hackrepair-smart-embed' ) . '</th><th>' . esc_html__( 'Notes', 'hackrepair-smart-embed' ) . '</th></tr></thead><tbody>';
            echo '<tr><td>' . esc_html__( 'YouTube/Vimeo video', 'hackrepair-smart-embed' ) . '</td><td><code>[smart_embed slug="product-video" responsive="true" max_width="800"]</code></td><td>' . esc_html__( 'Paste the iframe into the embed. Responsive keeps aspect ratio; set a max width.', 'hackrepair-smart-embed' ) . '</td></tr>';
            echo '<tr><td>' . esc_html__( 'Contact form (third‑party)', 'hackrepair-smart-embed' ) . '</td><td><code>[smart_embed slug="contact-form" class="form-embed"]</code></td><td>' . esc_html__( 'Forms are usually responsive already. Add a class for styling.', 'hackrepair-smart-embed' ) . '</td></tr>';
            echo '<tr><td>' . esc_html__( 'Google Map', 'hackrepair-smart-embed' ) . '</td><td><code>[smart_embed slug="store-map" responsive="true" max_width="600"]</code></td><td>' . esc_html__( 'Maps often benefit from a max width; adjust if too tall.', 'hackrepair-smart-embed' ) . '</td></tr>';
            echo '<tr><td>' . esc_html__( 'Newsletter signup', 'hackrepair-smart-embed' ) . '</td><td><code>[smart_embed slug="newsletter" class="sidebar-embed"]</code></td><td>' . esc_html__( 'Use a wrapper class to control spacing in sidebars.', 'hackrepair-smart-embed' ) . '</td></tr>';
            echo '</tbody></table>';
            echo '</div>';
            

            echo '<hr />';
            // Examples temporarily hidden for clarity
            if ( false ) {
            echo '<h3>' . esc_html__( 'Real‑world examples', 'hackrepair-smart-embed' ) . '</h3>';
            echo '<table class="widefat striped" style="margin-top:10px;">';
            echo '<thead><tr>';
            echo '<th>' . esc_html__( 'Use case', 'hackrepair-smart-embed' ) . '</th>';
            echo '<th>' . esc_html__( 'Shortcode', 'hackrepair-smart-embed' ) . '</th>';
            echo '<th>' . esc_html__( 'Notes', 'hackrepair-smart-embed' ) . '</th>';
            echo '</tr></thead><tbody>';

            // Example 1: YouTube
            echo '<tr>';
            echo '<td>' . esc_html__( 'YouTube/Vimeo video', 'hackrepair-smart-embed' ) . '</td>';
            $ex1 = '[smart_embed slug="product-video" responsive="true" max_width="800"]';
            echo '<td><code>' . esc_html( $ex1 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex1 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Paste the iframe from the provider into the Smart Embed content. Responsive keeps the aspect ratio; set a sensible max width.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            // Example 2: Contact form
            echo '<tr>';
            echo '<td>' . esc_html__( 'Contact form (third‑party)', 'hackrepair-smart-embed' ) . '</td>';
            $ex2 = '[smart_embed slug="contact-form" class="form-embed"]';
            echo '<td><code>' . esc_html( $ex2 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex2 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Most forms are already responsive. Skip the responsive wrapper; add a class for styling.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            // Example 3: Google Map
            echo '<tr>';
            echo '<td>' . esc_html__( 'Google Map', 'hackrepair-smart-embed' ) . '</td>';
            $ex3 = '[smart_embed slug="store-map" responsive="true" max_width="600"]';
            echo '<td><code>' . esc_html( $ex3 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex3 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Maps often benefit from a max width. Test the aspect ratio; adjust CSS if it looks too tall.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            // Example 4: Newsletter widget
            echo '<tr>';
            echo '<td>' . esc_html__( 'Newsletter signup', 'hackrepair-smart-embed' ) . '</td>';
            $ex4 = '[smart_embed slug="newsletter" class="sidebar-embed"]';
            echo '<td><code>' . esc_html( $ex4 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex4 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Use a wrapper class to control spacing in sidebars or narrow columns.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            // Example 5: Trust badge / ad script
            echo '<tr>';
            echo '<td>' . esc_html__( 'Trust badge / ad script', 'hackrepair-smart-embed' ) . '</td>';
            $ex5 = '[smart_embed slug="trust-badge"]';
            echo '<td><code>' . esc_html( $ex5 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex5 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Don’t wrap scripts responsively; let the provider7s script handle sizing. Keep it asynchronous if possible.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            // Example 6: Two‑column layout helper
            echo '<tr>';
            echo '<td>' . esc_html__( 'Float/right‑aligned embed', 'hackrepair-smart-embed' ) . '</td>';
            $ex6 = '[smart_embed slug="badge" class="alignright small-embed"]';
            echo '<td><code>' . esc_html( $ex6 ) . '</code> <button type="button" class="button hrgse-copy" data-clip="' . esc_attr( $ex6 ) . '">' . esc_html__( 'Copy', 'hackrepair-smart-embed' ) . '</button></td>';
            echo '<td>' . esc_html__( 'Create small badges or widgets that sit beside text. Add CSS for .small-embed as needed.', 'hackrepair-smart-embed' ) . '</td>';
            echo '</tr>';

            echo '</tbody></table>';
            }

            // Legacy inline guidance removed (now provided via includes/settings.php)
            }
            // Data/options form (below Tips)
            echo '<hr />';
            echo '<form method="post" action="options.php">';
            settings_fields( 'hrgse_settings_group' );
            echo '<h3>' . esc_html__( 'Smart Embed Options', 'hackrepair-smart-embed' ) . '</h3>';

            // URL embeds toggle and allowed domains
            $url_enable = get_option( 'hrgse_enable_url_embeds', 0 );
            echo '<p>';
            echo '<label><input type="checkbox" name="hrgse_enable_url_embeds" value="1" ' . checked( '1', (string) $url_enable, false ) . ' /> ' . esc_html__( 'Enable URL embeds', 'hackrepair-smart-embed' ) . '</label>';
            echo '<br /><span class="description">' . esc_html__( 'Allows enqueuing an external JavaScript via URL from the Smart Embed editor. HTTPS only; restricted to approved domains.', 'hackrepair-smart-embed' ) . '</span>';
            echo '</p>';

            $allowed_domains_text = (string) get_option( 'hrgse_allowed_domains', '' );
            if ( '' === trim( $allowed_domains_text ) ) {
                // Prefill with defaults when empty (UI convenience; saved on submit)
                $home  = home_url();
                $u     = wp_parse_url( $home );
                $host  = ( is_array( $u ) && ! empty( $u['host'] ) ) ? strtolower( $u['host'] ) : '';
                $seed  = $host ? $host . "\n" : '';
                $seed .= "cdn.jsdelivr.net\ncdn.tailwindcss.com\ncdnjs.cloudflare.com\nhtml2canvas.hertzen.com";
                $allowed_domains_text = self::sanitize_allowed_domains( $seed );
            }
            echo '<p>';
            echo '<label for="hrgse_allowed_domains"><strong>' . esc_html__( 'Allowed domains', 'hackrepair-smart-embed' ) . '</strong></label><br />';
            echo '<textarea name="hrgse_allowed_domains" id="hrgse_allowed_domains" rows="4" style="width:100%">' . esc_textarea( $allowed_domains_text ) . '</textarea>';
            echo '<br /><span class="description">' . esc_html__( 'One domain per line. Subdomains of a domain are permitted. Example: cdn.example.com', 'hackrepair-smart-embed' ) . '</span>';
            echo '</p>';

            // Example block
            echo '<div class="notice-info" style="padding:10px;border:1px solid #ccd0d4;background:#f6fbff;">';
            echo '<p><strong>' . esc_html__( 'Example', 'hackrepair-smart-embed' ) . '</strong></p>';
            $example_host = 'cdn.example.com';
            $list_hosts = preg_split( '/[\r\n,]+/', (string) $allowed_domains_text );
            if ( ! empty( $list_hosts ) && ! empty( $list_hosts[0] ) ) {
                $first = trim( (string) $list_hosts[0] );
                if ( $first !== '' ) { $example_host = $first; }
            }
            echo '<p style="margin:6px 0;">' . esc_html__( 'Allowed domains:', 'hackrepair-smart-embed' ) . ' <code>' . esc_html( $example_host ) . '</code></p>';
            echo '<p style="margin:6px 0;">' . esc_html__( 'In the Smart Embed editor, set External Script URL to:', 'hackrepair-smart-embed' ) . ' <code>https://' . esc_html( $example_host ) . '/widget.js</code></p>';
            echo '<p style="margin:6px 0;" class="description">' . esc_html__( 'The script will load once per page with defer (HTTPS only).', 'hackrepair-smart-embed' ) . '</p>';
            echo '</div>';

            $delete_flag = get_option( 'hrgse_delete_on_deactivate', 0 );
            echo '<p>';
            echo '<label><input type="checkbox" name="hrgse_delete_on_deactivate" value="1" ' . checked( '1', (string) $delete_flag, false ) . ' /> ' . esc_html__( 'Delete Smart Embed tables and data on deactivation', 'hackrepair-smart-embed' ) . '</label>';
            echo '<br /><span class="description">' . esc_html__( 'Warning: Permanently deletes all Smart Embeds and plugin options when the plugin is deactivated. This action cannot be undone.', 'hackrepair-smart-embed' ) . '</span>';
            echo '</p>';
            submit_button( __( 'Save Changes', 'hackrepair-smart-embed' ) );
            echo '</form>';
            echo '</div>';
        }

        echo '</div>';
    }

    // Removed separate Author Notes submenu; notes are available as a tab within Settings.

    private static function to_bool( $value ) {
        if ( is_bool( $value ) ) { return $value; }
        $value = strtolower( trim( (string) $value ) );
        return in_array( $value, array( '1', 'true', 'yes', 'on' ), true );
    }

    private static function sanitize_class_list( $classes ) {
        $out = array();
        foreach ( preg_split( '/\s+/', (string) $classes ) as $cls ) {
            $cls = trim( $cls );
            if ( '' === $cls ) { continue; }
            $out[] = sanitize_html_class( $cls );
        }
        return trim( implode( ' ', array_unique( $out ) ) );
    }

    private static function sanitize_html_id_attr( $value ) {
        $id = trim( (string) $value );
        if ( '' === $id ) { return ''; }
        // Allow [A-Za-z0-9_:-] and dashes; strip others
        $id = preg_replace( '/[^A-Za-z0-9_:\\-]/', '', $id );
        if ( '' === $id ) { return ''; }
        return $id;
    }

    public static function sanitize_allowed_domains( $value ) {
        // Accept newline or comma separated; return a normalized string (one per line)
        $raw = is_array( $value ) ? implode( "\n", $value ) : (string) $value;
        $parts = preg_split( '/[\r\n,]+/', $raw );
        $out = array();
        foreach ( $parts as $p ) {
            $p = strtolower( trim( $p ) );
            if ( '' === $p ) { continue; }
            // Extract host if a URL is mistakenly provided
            $host = $p;
            if ( false !== strpos( $p, '://' ) ) {
                $u = wp_parse_url( $p );
                if ( is_array( $u ) && ! empty( $u['host'] ) ) {
                    $host = strtolower( $u['host'] );
                }
            }
            // Strip leading dot
            $host = ltrim( $host, '.' );
            // Allow only host-safe chars
            if ( preg_match( '/^[a-z0-9.-]+$/', $host ) ) {
                $out[] = $host;
            }
        }
        $out = array_values( array_unique( $out ) );
        return implode( "\n", $out );
    }

    private static function get_allowed_domains() {
        $raw = (string) get_option( 'hrgse_allowed_domains', '' );
        $parts = preg_split( '/[\r\n,]+/', $raw );
        $out = array();
        foreach ( $parts as $p ) {
            $p = strtolower( trim( $p ) );
            if ( '' === $p ) { continue; }
            $out[] = ltrim( $p, '.' );
        }
        return array_values( array_unique( $out ) );
    }

    private static function url_embeds_enabled() {
        return '1' === (string) get_option( 'hrgse_enable_url_embeds', '0' );
    }

    private static function is_host_allowed( $host, $allowed ) {
        $host = strtolower( (string) $host );
        if ( '' === $host ) { return false; }
        foreach ( $allowed as $allow ) {
            if ( $host === $allow ) { return true; }
            if ( substr( $host, - ( strlen( $allow ) + 1 ) ) === '.' . $allow ) { return true; }
        }
        return false;
    }

    private static function is_url_allowed( $url ) {
        $url = (string) $url;
        if ( '' === $url ) { return false; }
        $u = wp_parse_url( $url );
        if ( ! is_array( $u ) ) { return false; }
        if ( empty( $u['scheme'] ) || 'https' !== strtolower( $u['scheme'] ) ) { return false; }
        $host = isset( $u['host'] ) ? strtolower( $u['host'] ) : '';
        if ( '' === $host ) { return false; }
        $allowed = self::get_allowed_domains();
        if ( empty( $allowed ) ) { return false; }
        return self::is_host_allowed( $host, $allowed );
    }

    private static function enqueue_external_script( $url ) {
        if ( '' === (string) $url ) { return; }
        $handle = 'hrgse-ext-' . md5( $url );
        if ( ! wp_script_is( $handle, 'enqueued' ) && ! wp_script_is( $handle, 'registered' ) ) {
            wp_register_script( $handle, $url, array(), null, true );
            if ( function_exists( 'wp_script_add_data' ) ) {
                wp_script_add_data( $handle, 'defer', true );
            }
        }
        wp_enqueue_script( $handle );
    }

    
    public static function sanitize_checkbox( $value ) {
        return ( ! empty( $value ) && ( '1' === $value || 1 === $value || true === $value ) ) ? '1' : '0';
    }

    public static function activate() {
        // Ensure CPT is registered before flushing.
        self::register_cpt();
        flush_rewrite_rules();

        // If no allowed domains are set yet, default to current site domain and common CDNs.
        $allowed = get_option( 'hrgse_allowed_domains', '' );
        if ( '' === trim( (string) $allowed ) ) {
            $home = home_url();
            $u    = wp_parse_url( $home );
            $host = ( is_array( $u ) && ! empty( $u['host'] ) ) ? strtolower( $u['host'] ) : '';
            $defaults = array();
            if ( $host ) { $defaults[] = $host; }
            $defaults[] = 'cdn.jsdelivr.net';
            $defaults[] = 'cdn.tailwindcss.com';
            $defaults[] = 'cdnjs.cloudflare.com';
            $defaults[] = 'html2canvas.hertzen.com';
            $seed = implode( "\n", $defaults );
            $sanitized = self::sanitize_allowed_domains( $seed );
            if ( $sanitized ) {
                update_option( 'hrgse_allowed_domains', $sanitized );
            }
        }
    }

    public static function deactivate() {
        flush_rewrite_rules();
        $delete_flag = get_option( 'hrgse_delete_on_deactivate', '0' );
        if ( '1' === (string) $delete_flag ) {
            self::delete_all_data();
        }
    }

    private static function delete_all_data() {
        // No custom tables in this plugin; remove CPT posts and plugin options
        $ids = get_posts( array(
            'post_type'        => 'smart-embed',
            'post_status'      => 'any',
            'numberposts'      => -1,
            'fields'           => 'ids',
            'no_found_rows'    => true,
            'suppress_filters' => true,
        ) );
        if ( $ids && is_array( $ids ) ) {
            foreach ( $ids as $pid ) {
                wp_delete_post( $pid, true ); // force delete (skip trash)
            }
        }
        // Remove plugin options
        delete_option( 'hrgse_delete_on_deactivate' );
        delete_option( 'hrgse_enable_url_embeds' );
        delete_option( 'hrgse_allowed_domains' );
    }
}
