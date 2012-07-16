/********************************************************************************
 *                                                                              *
 *  (c) Copyright 2011 University of Leeds, UK                                  *
 *  (c) Copyright 2010 The Open University UK                                   *
 *                                                                              *
 *  This software is freely distributed in accordance with                      *
 *  the GNU Lesser General Public (LGPL) license, version 3 or later            *
 *  as published by the Free Software Foundation.                               *
 *  For details see LGPL: http://www.fsf.org/licensing/licenses/lgpl.html       *
 *               and GPL: http://www.fsf.org/licensing/licenses/gpl-3.0.html    *
 *                                                                              *
 *  This software is provided by the copyright holders and contributors "as is" *
 *  and any express or implied warranties, including, but not limited to, the   *
 *  implied warranties of merchantability and fitness for a particular purpose  *
 *  are disclaimed. In no event shall the copyright owner or contributors be    *
 *  liable for any direct, indirect, incidental, special, exemplary, or         *
 *  consequential damages (including, but not limited to, procurement of        *
 *  substitute goods or services; loss of use, data, or profits; or business    *
 *  interruption) however caused and on any theory of liability, whether in     *
 *  contract, strict liability, or tort (including negligence or otherwise)     *
 *  arising in any way out of the use of this software, even if advised of the  *
 *  possibility of such damage.                                                 *
 *                                                                              *
 ********************************************************************************/
var ARGVIZ = ARGVIZ || {};
ARGVIZ.network = ARGVIZ || {};

(function (MODULE_NAME) {

    function convertCohereData (cohere_json) {

        // Pointer to just the array of connections in the ConnectionSet object
        var connections = cohere_json.connectionset[0].connections;

		    var d3Json = {
				    nodes: [],
				    links: []
		    };

		    var nodePositions = {};
        var i, len = connections.length;

		    function nodeExists(theNode) {
            var i, len = d3Json.nodes.length;
				    for (i = 0; i < len; i++) {
						    if (theNode.nodeid == d3Json.nodes[i].nodeid) {
								    return true;
						    }
				    }

				    return false;
		    }

		    for (i = 0; i < len; i++) {
				    // First deal with the nodes
				    var fromCnode = jQuery.extend(
						    true, {}, connections[i].connection.from[0].cnode);

				    var toCnode = jQuery.extend(
						    true, {}, connections[i].connection.to[0].cnode);

            // Copy Cohere 'role name' into new attribute called 'nodetype'
            fromCnode.nodetype = fromCnode.role[0].role.name;
            toCnode.nodetype = toCnode.role[0].role.name;

				    if (!nodeExists(fromCnode)) {
						    var position = d3Json.nodes.push(fromCnode) - 1;
						    nodePositions[fromCnode.nodeid] = position;

						    // Count the number of links the node is involved in. This
						    // is the first link.
						    d3Json.nodes[position].numlinks = 1;
				    } else {
						    // Add 1 to the number of links the node is involved in.
						    var position = nodePositions[fromCnode.nodeid];
						    d3Json.nodes[position].numlinks += 1;
				    }

				    if (!nodeExists(toCnode)) {
						    var position = d3Json.nodes.push(toCnode) - 1;
						    nodePositions[toCnode.nodeid] = position;

						    // Count the number of links the node is involved in. This
						    // is the first link.
						    d3Json.nodes[position].numlinks = 1;
				    } else {
						    // Add 1 to the number of links the node is involved in.
						    var position = nodePositions[toCnode.nodeid];
						    d3Json.nodes[position].numlinks += 1;
				    }

				    // Now deal with the links
				    var newLink = {};
				    newLink.connid = connections[i].connection.connid;
				    newLink.source = nodePositions[fromCnode.nodeid];
				    newLink.target = nodePositions[toCnode.nodeid];
				    newLink.label =
						    connections[i].connection.linktype[0].linktype.label;
				    newLink.polarity =
						    connections[i].connection.linktype[0].linktype.grouplabel
						    .toLowerCase();
				    d3Json.links.push(newLink);
		    }

		    return d3Json;
    }

		function moveto (d) {
				// Locate the node where the path will start
				var node = d3.select("#node"+d.source.index);

				if (node.empty()) {
						// The node isn't part of the DOM as yet so use the
						// initial (x,y) coordinates generated by the earlier
						// running of the D3 force layout.
            d.source.newX = d.source.x;
            d.source.newY = d.source.y;
				} else {
						// The node is now part of the DOM, so...
						// Retrieve the width and height attributes...
						var w = parseFloat(node.attr("width"));
						var h = parseFloat(node.attr("height"));

						// ...so we can change the x,y coordinates of the node to be
						// at its center rather than the top-left corner
						d.source.newX = d.source.x + (w/2);
						d.source.newY = d.source.y + (h/2);
				}

        return "M" + d.source.newX + "," + d.source.newY;
		}

		function lineto (d) {
				// Locate the node where the path will end
				var node = d3.select("#node"+d.target.index);

				if (node.empty()) {
						// The node isn't part of the DOM as yet so use the
						// initial (x,y) coordinates generated by the earlier
						// running of the D3 force layout.
            d.target.newX = d.target.x;
            d.target.newY = d.target.y;
				} else {
						// The node is now part of the DOM, so...
						// Retrieve the width and height attributes...
						var w = parseFloat(node.attr("width"));
						var h = parseFloat(node.attr("height"));

						// ...so we can locate the x,y coordinates of the center of
						// the node...
						d.target.centerX = d.target.x + (w/2);
						d.target.centerY = d.target.y + (h/2);

						// ...which we will use to calculate the x,y coordinates of
						// the point on the perimeter of the node where the path will
						// end -- the idea is that the arrowhead at the end of the
						// path is "smart" enough to move around the perimeter of the
						// rectangular node as the node moves around the screen.
						// 'smartPathEnd()' creates a set of new coordinates for
						// the target node. These new coordinates are stored in
						// 'newX' and 'newY'.
						smartPathEnd(d, w, h);
				}

        return " L" + d.target.newX + "," + d.target.newY;
		}

		/* We want to the end of the path to be able to move around the
			 perimeter of the rectangular node as the node moves around the
			 screen.
			 We achieve this by using trigonometry to work out where an
			 imaginary path to the center of the target node would intersect
			 the perimeter of the node, and then drawing the actual path
			 from source node to this intersection point. */
		function smartPathEnd(d, w, h) {

				// We need to work out the (tan of the) angle between the
				// imaginary horizontal line running through the center of the
				// target node and the imaginary line connecting the center of
				// the target node with the top-left corner of the same
				// node. Of course, this angle is fixed.
				var tanRatioFixed =
						(d.target.centerY - d.target.y)
						/
						(d.target.centerX - d.target.x);

				// We also need to work out the (tan of the) angle between the
				// imaginary horizontal line running through the center of the
				// target node and the imaginary line connecting the center of
				// the target node with the center of the source node. This
				// angle changes as the nodes move around the screen.
				var tanRatioMoveable =
						Math.abs(d.target.centerY - d.source.newY)
						/
						Math.abs(d.target.centerX - d.source.newX); // Note,
						// JavaScript handles division-by-zero by returning
						// Infinity, which in this case is useful, especially
						// since it handles the subsequent Infinity arithmetic
						// correctly.

				// Now work out the intersection point

				if (tanRatioMoveable == tanRatioFixed) {
						// Then path is intersecting at corner of textbox so draw
						// path to that point

						// By default assume path intersects a left-side corner
						d.target.newX = d.target.x;

						// But...
						if (d.target.centerX < d.source.newX) {
								// i.e. if target node is to left of the source node
								// then path intersects a right-side corner
								d.target.newX = d.target.x + w;
						}

						// By default assume path intersects a top corner
						d.target.newY = d.target.y;

						// But...
						if (d.target.centerY < d.source.newY) {
								// i.e. if target node is above the source node
								// then path intersects a bottom corner
								d.target.newY = d.target.y + h;
						}
				}

				if (tanRatioMoveable < tanRatioFixed) {
						// Then path is intersecting on a vertical side of the
						// textbox, which means we know the x-coordinate of the
						// path endpoint but we need to work out the y-coordinate

						// By default assume path intersects left vertical side
						d.target.newX = d.target.x;

						// But...
						if (d.target.centerX < d.source.newX) {
								// i.e. if target node is to left of the source node
								// then path intersects right vertical side
								d.target.newX = d.target.x + w;
						}

						// Now use a bit of trigonometry to work out the y-coord.

						// By default assume path intersects towards top of node
						d.target.newY =
								d.target.centerY - ((d.target.centerX - d.target.x)
																		*
																		tanRatioMoveable);

						// But...
						if (d.target.centerY < d.source.newY) {
								// i.e. if target node is above the source node
								// then path intersects towards bottom of the node
								d.target.newY = (2 * d.target.y) - d.target.newY + h;
						}
				}

				if (tanRatioMoveable > tanRatioFixed) {
						// Then path is intersecting on a horizontal side of the
						// textbox, which means we know the y-coordinate of the
						// path endpoint but we need to work out the x-coordinate

						// By default assume path intersects top horizontal side
						d.target.newY = d.target.y;

						// But...
						if (d.target.centerY < d.source.newY) {
								// i.e. if target node is above the source node
								// then path intersects bottom horizontal side
								d.target.newY = d.target.y + h;
						}

						// Now use a bit of trigonometry to work out the x-coord.

						// By default assume path intersects towards lefthand side
						d.target.newX =
								d.target.centerX - ((d.target.centerY - d.target.y)
																		/
																		tanRatioMoveable);

						// But...
						if (d.target.centerX < d.source.newX) {
								// i.e. if target node is to left of the source node
								// then path intersects towards the righthand side
								d.target.newX = (2 * d.target.x) - d.target.newX + w;
						}
				}
		}

    function draw(config) {
        var data = config.data;
        var container = (typeof config.container === 'string') ?
            '#' + config.container :
            config.container;

		    // Set width & height for div that contains SVG visualisation
        jQuery(container).html('<div id="network-div"></div>');

		    jQuery("#network-div").css("overflow", "hidden")
				    .height(jQuery(window).height())
				    .width(jQuery(container).width());

		    // Calculate desired width and height for the SVG visualisation.
		    // Make quite large so text nodes aren't cropped.
		    var w = jQuery(document).width() * 2;
		    var h = jQuery(document).height() * 2;

		    var vis = d3.select("#network-div")
				    .append("svg:svg")
				    .attr("id", "arg-viz")
				    .attr("width", w)
				    .attr("height", h);

		    var map = new SpryMap({
				    id : "arg-viz",
            height: h,
            width: w,
            startX: 0,
            startY: 0,
				    lockEdges: false,
				    scrolling: false});

        jQuery('#arg-viz').before('<div id ="loading">Loading...</div>');

		    vis.style("opacity", 1e-6)
				    .transition()
				    .duration(1000)
				    .style("opacity", 1);

		    // Add zoom behaviour to the visualisation
        vis.call(d3.behavior.zoom().on("zoom", function () {
            vis.attr("transform", "translate(" + d3.event.translate + ")" +
                     "scale(" + d3.event.scale + ")");
        }))

		    // Intercept the "mousedown" event attached to the zoom behaviour
		    // so it doesn't interfere with the SpryMap dragging behaviour
				    .on("mousedown.zoom", function(){ return false;})

		    // Allow mousewheel to be used for zooming. This means we have to
		    // prevent mousewheel from scrolling the page. "DOMMouseScroll" is
		    // included for Firefox compatibility.
				    .on("mousewheel", function () { d3.event.preventDefault(); })
				    .on("DOMMouseScroll", function () { d3.event.preventDefault(); });

		    // To make it easy to adjust the scale when zooming, group all of
		    // the visualisation together in an "<svg:g>" element so we can
		    // apply the scaling transformation to that containing element.
		    vis = vis.append("svg:g");

		    var defs = vis.append("svg:defs");
        defs = link_arrowheads(defs);
        defs = node_shadows(defs);

		    // Run the force directed layout algorithm
		    // XXX
		    // Note, with such a large setting for width and height, the
		    // visualisation is likely to be drawn off-screen. Thus, later,
		    // when layout is stopped we have to bring the visualisation back
		    // into the center of the containing div using CSS negative
		    // margins. This is a temporary solution until a proper way is
		    // found to display the visualisation in the centre of the
		    // containing div while at the same time giving room for
		    // visualisation to be drawn so no text-nodes are cropped.
		    var force = d3.layout.force()
				    .charge(-5000)
				    .linkDistance(175)
				    .nodes(data.nodes)
				    .links(data.links)
				    .size([w, h])
				    .start()
            .on("tick", tick);

		    // First draw the links
		    var link = vis.selectAll("g.link")
				    .data(data.links)
				    .enter().append("svg:g")
				    .attr("class", "link");

        link = draw_links(link);

		    // Now draw the nodes
		    var node = vis.selectAll("g.node")
				    .data(data.nodes)
				    .enter().append("svg:g")
				    .attr("class", "node");

        node = draw_nodes(node);

		    node.selectAll("rect")
				    .attr("height",
							    function() {
									    return this.parentNode.getAttribute("height"); })
				    .attr("width",
							    function() {
									    return this.parentNode.getAttribute("width"); });

		    // Make nodes draggable
				node.call(force.drag)
		    // When node is clicked to be dragged, stop the mousedown event
		    // from propagating to SpryMap event listener attached to parent,
		    // which is used to allow map as a whole to be draggable.
				    .on("mousedown", function() {d3.event.stopPropagation();})
        // When node is dragged, 'mousemove' triggers force.resume(). Disable
        // this behavior by calling force.stop() instead.
            .on('mousemove', function() {force.stop();});

        // Execute any function that was passed in for nodes
        config.node_fn && node.each(config.node_fn);

		    // Give "Issue" nodes a separate styling
		    node.select(function (d) {
				    return (d.nodetype === "Issue") ? this : null;	})
				    .attr("class", "issue-node");

		    // For "Argument" nodes, append a small circle that will be used
		    // to toggle expansion on the Argument node.
		    node.select(function(d) {
				    // First select only the "Argument" nodes from the set of all
				    // nodes
				    return (d.nodetype === "Argument") ? this : null;})
				    .append("svg:circle")
				    .style("stroke", "steelblue")
				    .style("cursor", "pointer")
				    .attr("r", 5)
		    // By default the Argument nodes are not expanded
				    .each(function(d) {
						    d.expand = false;
						    update(d);
				    })
            .on("click", function (d) {
            // Toggle expansion of clicked node and update visualisation
                d.expand = d.expand ? false : true;
                d3.event.stopPropagation();
                update(d);
            });

		    // Update the visualisation when user clicks to toggle expansion
		    // of Argument node. Currently the function only hides the links
		    // and the Statement nodes connected to the Argument node the user
		    // has clicked (i.e. it doesn't update the underlying
		    // force-directed network drawn on the page)
		    function update(source) {
				    node.select(function(d) {
						    return (source.index === d.index) ? this : null;})
						    .select("circle")
                .attr("class", function (d) { return d.expand ?
                    "expanded" : "collapsed";
                });

				    // Display a tooltip whenever user hovers over the circle for
				    // toggling expansion. Tooltip prompts user to view or hide
				    // Statement nodes connected to Argument node.
				    jQuery('circle.collapsed').tipTip({
						    activation: "hover",
						    defaultPosition: "top",
						    delay: 0,
						    content: "View the justification for this argument"
				    });

				    jQuery('circle.expanded').tipTip({
						    activation: "hover",
						    defaultPosition: "top",
						    delay: 0,
						    content: "Hide the justification for this argument"
				    });

				    // Once the user clicks the circle (and the update() function
				    // is called) then hide any tooltip being displayed until next
				    // time user hovers over
				    jQuery("#tiptip_holder").hide();

            expand_node(source, node, link);

		    }

        function expand_node(source, node, link) {

            // For this source node, get all the outgoing links where the
            // target node is a Statement
            link.select(function (d) {
                // First get the links where 'source' is the source node
                return (source.index === d.source.index) ? this : null;})
            // Then further filter those links to just those with
            // 'Statement' as target node
                .select(function (d) {
                    return !(node.select(function (n) {
                        return ((n.index === d.target.index) &&
                                (n.nodetype === "Statement")) ?
                            this : null;} ).empty()) ? this : null;})
            // Hide the outgoing links
                .each(function (d) {
                    d.hidden = source.expand ? false : true;})
                    .style("display", function (d) {
                        return d.hidden ? "none" : "";})
            // Find if they are any nodes left isolated and hide them
                .each(function(d) {
                    node.select(function (n) {
                        return (n.index === d.target.index) ? this : null;})
                        .each(function (n) {
                            // If link connecting a node is hidden then
                            // reduce the 'numlinks' count for that node
                            // by 1. If link is displayed again then
                            // increase 'numlinks' count for that node by
                            // 1.
                            n.numlinks = d.hidden ?
                                      n.numlinks - 1 :
                                      n.numlinks + 1;
                        })
                        // If 'numlinks' count for a node is 0 then
                        // hide that node.
                        .style("display", function (n) {
                            return (n.numlinks === 0) ? "none" : "";
                         });
                });
        }

        /*
         * The 'tick' function for the force layout
         */
		    function tick(e) {
            link = transform_links(link);
            node = transform_nodes(node);


				    // Don't wait until force-directed algorithm completely
				    // finishes (i.e. alpha == 0). Freeze the nodes when network
				    // gets fairly stable (< 0.009 seems to work well). Fixing the
				    // nodes also means the force-directed layout isn't resumed
				    // when nodes are dragged. So this achieves the result of
				    // removing the "bouncy" effect of the network visualisation
				    if (e.alpha < 0.009) {
                force.stop();

                jQuery('#loading').hide();

                // Fade in the diagram
		            vis.style("opacity", 1e-6)
				            .transition()
				            .duration(1000)
				            .style("opacity", 1);

						    node.each(function (d) { d.fixed = true; });

						    // XXX Need to find a better way of positioning the
						    // visualisation in the middle of the container, while at
						    // the same time giving it enough space so none of the
						    // nodes is cropped. For now calculate the center of where
						    // the visualisation was drawn, then calculate the center
						    // of the containing div, and use CSS negative margins to
						    // make the adjustment.

						    // Get center of the containing div
						    var container_div_center = {
								    x: jQuery("#network-div").width() / 2,
								    y: jQuery("#network-div").height() / 2};

						    // Get the max and min x,y coordinates of the
						    // visualisation so we can calculate the center.
						    var min_x, min_y, max_x, max_y;

						    node.each(function (d) {
								    if (min_x === undefined) {
										    min_x = max_x = d.x;
										    min_y = max_y = d.y;
								    } else if (d.x < min_x) {
										    min_x = d.x;
								    } else if (d.x > max_x) {
										    max_x = d.x;
								    } else if (d.y < min_y) {
										    min_y = d.y;
								    } else if (d.y > max_y) {
										    max_y = d.y;
								    }
						    });

						    var visualisation_center = {
								    x: (min_x + max_x) / 2,
								    y: (min_y + max_y) / 2
						    };

						    // Calculate negative margin-top and margin-left amount
						    var top_adjustment =
								    container_div_center.y - visualisation_center.y;
						    var left_adjustment =
								    container_div_center.x - visualisation_center.x;

						    jQuery("#arg-viz").css("margin-top", top_adjustment+"px")
								    .css("margin-left", left_adjustment+"px");

                // Invoke callback function if there is one
                config.callback && config.callback();
				    }
		    }
    }

    function link_arrowheads(defs) {

        // Define arrowheads for links
        defs.append("svg:marker")
            .attr("id", "arrowhead")
            .attr("viewBox","0 0 20 20")
            .attr("refX","30")
            .attr("refY","10")
            .attr("markerUnits","strokeWidth")
            .attr("markerWidth","11")
            .attr("markerHeight","7")
            .attr("orient","auto")
            .append("svg:path")
            .attr("d","M 0 0 L 20 10 L 0 20 z");

        return defs;
    }

    function node_shadows(defs) {

        // Define dropshadow for nodes
        var filter = defs.append("svg:filter")
            .attr("id", "drop-shadow")
            .attr("filterUnits", "userSpaceOnUse");


        filter.append("svg:feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 1)
            .attr("result", "blur-output");

        filter.append("svg:feOffset")
            .attr("in", "blur-output")
            .attr("result", "the-shadow")
            .attr("dx", 1.5)
            .attr("dy", 1.5);

        filter.append("svg:feBlend")
            .attr("in", "SourceGraphic")
            .attr("in2", "the-shadow")
            .attr("mode", "normal");

        return defs;
    }

    function draw_links(l) {

        l.append("svg:path")
            .attr("id", function (d) {
               return "path" + d.source.index + "_" + d.target.index;
            })
            .attr("label", function (d) { return d.label; })
            .attr("class", function (d) { return d.polarity; })
            .attr("marker-end", "url(#arrowhead)");

        l.append("svg:text")
            .attr("font-size", 10)
            .text(function (d) { return d.label; });

        l = transform_links(l);

        return l;
    }

    function draw_nodes(n) {
        n.attr("id", function (d) { return "node" + d.index; });

        n.append("svg:rect")
            .attr("rx", 3)
            .attr("filter", "url(#drop-shadow)");

        n.append("svg:text")
            .attr("font-size", 10)
            .attr("y", 10)
            .attr("text-anchor", "start")
            .each(function (d) {
                // textFlow(myText,textToAppend,maxWidth,x,ddy,justified)
                var dy = textFlow(d.name, this, 225, 5, 10, false);

                // Get the bounding box of the text element so that we can
                // adjust the rectangle to suit
                var bb = this.getBBox();
                this.parentNode.setAttribute("height", bb.height+5);
                this.parentNode.setAttribute("width", bb.width+10);
            });

        n = transform_nodes(n);

        return n;
    }

     function transform_links(l) {
         l.select("path")
             .attr("d", function (d) { return moveto(d) + lineto(d); });

         // Put link-label in middle of line
         l.select("text")
             .attr("x", function (d) {
                 return (d.target.newX + d.source.newX) / 2;
             })
             .attr("y", function (d) {
                 return (d.target.newY + d.source.newY) / 2;
             });

         return l;
    }

    function transform_nodes(n) {
        return n.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    }

    // Expose public API for the module
    MODULE_NAME.convertCohereData = convertCohereData;
    MODULE_NAME.draw = draw;

})(ARGVIZ.network);
