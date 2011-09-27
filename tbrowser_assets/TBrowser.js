/**
 * 
 * @author Naba Bana
 *
 * Object $tb
 *
 * Defining namespace. It is the only global object.
 *
 */

window.$tb = function () {

}

// Classes
//

/**
 * Class TBrowser
 */
$tb.TBrowser = function(config, allowMultipleSelected, autoExpandSelected, autoExpandMarked, autoExpandLevels, maxColumns, elasticCanvasHeight, autoCollapse, autoScroll, callBack, ctx, autoCallBack) {
    this._id = "TBrowser-"+guid();
    $.extend(this, new EventDispatcher());

    this._actionList = [];
    this._nodeIndex = {};
    this._nodesToLevels = [];
    this._nodeIndexesToLevels = [];

    this._columns = [];
    this._tbNodes = {};
    this._panels = {};

    this.animate = this.animate && !IsIE8Browser();

    this.allowMultipleSelected = allowMultipleSelected;
    this.autoExpandSelected = autoExpandSelected;
    this.elasticCanvasHeight = elasticCanvasHeight;
    this.autoExpandMarked = autoExpandMarked;
    this.autoExpandLevels = autoExpandLevels;
    this.maxColumns = maxColumns;
    this.autoCollapse = autoCollapse;
    this.autoScroll = autoScroll;
    this.callBack = callBack;
    this.ctx = ctx;
    this.autoCallBack = autoCallBack;

    this.setCanvas($("#"+config.canvasId));
    this.nodeRenderer = config.nodeRenderer;

    if (isSet(config.autofold)) this.autofold = config.autofold;
    if (isSet(config.configuration)) this.setConfiguration(config.configuration);
   

    trace("TBrowser ["+this._id+"] created");
}

$tb.TBrowser.prototype = {
    _id: null,
    _canvas: null,
    _paper:null,
    _data: null,
    paperContainer: null,
    activeTBNode: null,
    
    seaerching: null,
    pleaseWait:null,

    underConstruction: false,   
    beingRendered: false,

    _actionList: null,

    population: 0,

    // indexing
    _nodeIndex: null,
    _nodesToLevels: null,                  // Each element is an array of nodes
    _nodeIndexesToLevels:null,            // same as above but only ids for efficient searching

    wordIndex: null,                      // wordIndex of the taxonomy nodes
    wordUsage: null,

    activeNode: null,

    // Visual components
    _tb: null,
    _tbNodes: null,
    _columns: null,
    _panels: null,
    _connectors: null,

    // states of the browser, see tbrowserstate
    browserstate: null,

    // options
    maxColumns: 100,
    maxcolumns: true,                      // this is used if autofolds is true
    autoexpand: 0,                      // how many levels should be expanded automatically
    animate: true,                      // we will detect ie < 9 probably
    allowMultipleSelected: false,
    autoExpandSelected: false,
    elasticCanvasHeight: false,
    autoExpandMarked: false,
    autoExpandLevels: 0,
    autoCollapse: false,
    autoCallBack: false,

    callBack: null,
    ctx: null,

    nodeWeightingColors: [0x3333ff, 0xffffff],
   
    _onrendercomplete: function() {
        this.state = "ready";
    },

    _noderenderer: function(data) {
        
    },

    _erase: function() {
        // clearing indexes
        this._nodeindex = {};
        this._nodestolevels = [];
        _nodeindexestolevels = [];
    },

    showLevel: function(level) {
        trace("Showing level ["+level+"]");

        if (level>0) {
            level=level-1;

            var animate=this.animate;
            this.animate=false;

            if ($.isArray(this._nodesToLevels[level])) {
                for (var i=0; i<this._nodesToLevels[level].length; i++) {
                    this.expandNode(this._nodesToLevels[level][i]);
                }
            }
        } else {
            var animate=this.animate;
            this.animate=false;

            if ($.isArray(this._nodesToLevels[level])) {
                for (var i=0; i<this._nodesToLevels[level].length; i++) {
                    this.getNode(this._nodesToLevels[level][i]);
                }
            }

        }

        this.animate = animate;
    },

    getSelectedValues: function() {
        var result = [];
        for (var i=0; i<this.browserState.selectedNodes.length; i++) {
            var node = this._nodeIndex[this.browserState.selectedNodes[i]];
            result.push({id: node.id, label: node.name});
        }

        return result;
    },

    // Node manipulator UI actions

    getNode: function(node) {
        if (node && node.level > -1) {
            
            if (this._tbNodes[node.id]) {
                return this._tbNodes[node.id];
            }

            trace("Getting node ["+node.id+"]");
            
            var nodeColumn;

            if (this._columns[node.level]) {
                var nodeColumn = this._columns[node.level];
            } else {
                nodeColumn = new $tb.TBColumn(this, node.level);
                this._columns[node.level] = nodeColumn;
            }
            
            var tbNode = nodeColumn.getNode(node);


            return tbNode;
        }

    },

    removeNode: function(node, isForced) {
            trace("Removing node ["+node.id+"]");
            
            var result = [false, false, false];

            var nodeColumn;

            if (this._columns[node.level]) {
                var nodeColumn = this._columns[node.level];
                result =  nodeColumn.removeNode(node, isForced);
                if (result[0]) {
                    this._columns.removeElement(nodeColumn);
                    this.browserState.foldedColumns.removeElement(node.level);
                }
            }            

            return result;
    },

    expandNode: function(node, levelLimit) {

        if (node && (this.browserState.expandedNodes.indexOf(node.id) == -1)) {

            trace("Expanding ["+node.id+"]...");

            if (!isSet(levelLimit)) levelLimit = Infinity;

            // first take care of our node

            // expand the parents from the root first
            this.expandNode(node.parent, levelLimit);

            var nodeColumn;

            if (levelLimit>node.level) {
                var tbNode = this.getNode(node);
        
                if (tbNode) {
                    var result = tbNode.expand();
                    
                    return result;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    },

    collapseNode: function(node) {
        if (node) {
            trace("Collapsing ["+node.id+"]...");

            // first take care of our node

            // expand the parents from the root first
            this.expandNode(node.parent);

            var nodeColumn;

            var tbNode = this.getNode(node,  {});
        
            if (tbNode) {
                return tbNode.collapse();
            } else {
                return false;
            }
        }
        
    },

    selectNode: function(node) {
       if (node && (this.browserState.selectedNodes.indexOf(node.id) == -1)) {

            trace("Selecting ["+node.id+"]...");

            // expand the parents from the root first
            this.expandNode(node.parent);

            var tbNode = this.getNode(node);
    
            if (tbNode) {
                var result = tbNode.select();
                return result;
            } else {
                return false;
            }
        }
    },

    setMarkedPopulation: function(node, diff) {
        if (node) {
            
            node.markedPopulation += diff;
     
            var tbNode = this._tbNodes[node.id];
            if (tbNode) {
                 tbNode.refresh();
            }

            if (this.browserState.markedNodes.indexOf(node.id) > -1) {
                var diff = node.cumulatedPopulation - node.markedPopulation;
            }

            trace("PopulationDiff "+diff);

            if (node.parent) {
                this.setMarkedPopulation(node.parent, diff);
            }
        }
    },
    

    markNode: function(node) {

        if (node && (this.browserState.markedNodes.indexOf(node.id) == -1)) {
            trace("Marking ["+node.id+"]...");
                        
            this.browserState.markedNodes.push(node.id);

            var tbNode = this._tbNodes[node.id];
            if (tbNode) {
                 tbNode.mark();
                 tbNode.refresh();
            }
            
            var diff = node.cumulatedPopulation - node.markedPopulation;

            // marking the parents with hits
            if (node.parent) this.setMarkedPopulation(node.parent, diff);
        }
        
    },

    clearMarkedPopulation: function(node) {
        if (node && node.markedPopulation > 0) {

            node.markedPopulation = 0;
            var tbNode = this._tbNodes[node.id];
            if (tbNode) {
                 tbNode.unmark();
                 tbNode.refresh();
            }

            if (node.parent) this.clearMarkedPopulation(node.parent);
        }
  
    },

    unMarkAll: function() {
        if (this.browserState.markedNodes.length > 0) {
            trace("Un marking all...");
            
            for (var i=0; i < this.browserState.markedNodes.length; i++) {
                var node = this._nodeIndex[this.browserState.markedNodes[i]];

                node.markedPopulation = 0;

                var tbNode = this._tbNodes[node.id];
                if (tbNode) {
                     tbNode.unmark();
                }
                
                if (node.parent) this.clearMarkedPopulation(node.parent);
            }
        }

        this.browserState.markedNodes = [];

    },

    expandAll: function() {
        this.showLevel(this._nodesToLevels.length-1);
    },

    collapseAll: function() {
        trace("Collapsing all nodes...");
        if ($.isArray(this._nodesToLevels[0])) {
            for (var i=0; i<this._nodesToLevels[0].length; i++) {
                this.collapseNode(this._nodesToLevels[0][i]);
            }
        }
        
    },
    
    drawConnectorsUntilLevel: function(level) {
        if (this.activeTBNode) {
            this.activeTBNode.drawConnectorsUntilLevel(level);
        }                

        for (var i=0; i<this.browserState.selectedNodes.length; i++) {
            var tbNode = this._tbNodes[this.browserState.selectedNodes[i]];
            if (tbNode && tbNode != this.activeTBNode) tbNode.drawConnectorsUntilLevel(level);
        }         

    },

    eraseConnectorsUntilLevel: function(level) {
        if (this.activeTBNode) {
            this.activeTBNode.eraseConnectorsUntilLevel(level);
        }                

        for (var i=0; i<this.browserState.selectedNodes.length; i++) {
            var tbNode = this._tbNodes[this.browserState.selectedNodes[i]];
            if (tbNode && tbNode != this.activeTBNode) tbNode.eraseConnectorsUntilLevel(level);
        }         

    },

    recalculateHeight: function() {
        if (this.elasticCanvasHeight) {
            var h = this._tb.outerHeight()+20;
            trace(h);
            this._canvas.height(h);
            if (this.pleaseWait) {
                this.pleaseWait.height(h);
            }

            $(this._paper.canvas).height(h-20);
//            $(this._paper.canvas).width(this._canvas.width()-20);
            
        }
    },
    
    showPleaseWait: function() {
        if (this._canvas) {

            var pleaseWait = $("<div/>", {
                'class': 'PleaseWait'
            });

            this.pleaseWait = pleaseWait;

            pleaseWait.appendTo(this._canvas);
            pleaseWait.width(this._canvas.width());
            pleaseWait.height(this._canvas.height());
            
            pleaseWait.css("opacity", "0");
            
            if (this.animate) {
                pleaseWait.animate({
                    opacity: .7
                }, 500);
            } else {
                pleaseWait.css("opacity", .7);
            }
        }
    },

    hidePleaseWait: function() {
        if (this.pleaseWait) {
            if (this.animate) {
                this.pleaseWait.fadeOut(500, function(e) {
                    $(this).remove();        
                });
            } else {
                this.pleaseWait.remove();
            }
        }
    },

    checkWidth: function() {
        var width = 0;
        for (var i=0; i<this._columns.length; i++) {
            width+=this._columns[i].skin.width();
        }
        $(this._paper.canvas).width(width);
       
       // trace(width);
        if (this.maxColumns && width > this._canvas.width()) {
                
                for (var i=0; i<this._columns.length; i++) {
                    if (this._columns[i].state == "UNFOLDED") {
                       if (this.justUnfolded != this._columns[i]) {
                           var animate = this.animate;
                           this.animate = false;
                           this._columns[i].fold();
                           this.animate = animate;
                           break;
                       }
                    }
                }

        }
    },

    search: function(kword, cb) {

        if (!this.searching) {
            trace("Searching..");

            this.showPleaseWait();
            this.searching = true;

            var animate = this.animate;
            this.animate = false;

            this.unMarkAll();

            var markedNodes = [];
            var hits = 0;

            if (kword.length>3) {
                for (var i in this._nodeIndex) {
                    if (this._nodeIndex[i].name.indexOf(kword)> -1) {
                        hits++;

                        markedNodes.push(i);
                    }
                }

                trace("Number of hits: ["+hits+"]");
                // now we mark nodes
                if (markedNodes.length) {
                    for (var i=0; i<markedNodes.length; i++) {
                       var node = this._nodeIndex[markedNodes[i]];
                        if (node && node.level >= 0) {
                            this.markNode(node);   
                        }
                    }
                }

                result = {
                    'status': "OK",
                    'hits': hits
                };
            } else {
                result = {
                    'status': "ERASED"
                };                
            }

            this.animate = animate;
            this.drawConnectorsUntilLevel(0);
            this.hidePleaseWait();
            this.searching = false;

       } else {
            result = {
                'status': "BUSY"
            };                
       }
    
        if ($.isFunction(cb)) cb.call(this, result); 

    },


  

    // Getters/Setters
    
    setConfiguration: function(configuration) {
        if (!this.underConstruction) {
           
            this.underConstruction = true;
            this.showPleaseWait();

            if (this._data) this._erase();

            if (isSet(configuration.data)) {

                this._data = configuration.data;

                // filling in the "static" parameters
                this.browserState = new $tb.TBRowserState([], [], [], [], configuration.browserState[4]);

                // traversing the tree to build up index and references to parents
                 
                //this.wordIndex = [];
                //this.wordUsage = [];

                this.population = 0;
                var walkTree = function(node, level) {

                    node.parent = null;
                    node.level = level;
                    node.cumulatedPopulation = node.data.population;
                    node.markedPopulation = 0;

                    // building nodeIndexes
                    this._nodeIndex[node.id] = node;

                    var levelCollector = this._nodesToLevels[level] || [];
                    levelCollector.push(node);  

                    var levelIndexCollector = this._nodeIndexesToLevels[level] || [];
                    levelIndexCollector.push(node.id);

                    this._nodesToLevels[level] = levelCollector;
                    this._nodeIndexesToLevels[level] = levelIndexCollector;

                    if (level >= 0) this.population++;

                    

                    for (var i=0; i<node.children.length; i++) {
                        var child = node.children[i];
                       
                        walkTree.call(this, child, level+1);
                        child["parent"] = node;       // setting the parent

                        node.cumulatedPopulation += child.cumulatedPopulation;
                    }
                }
                
                walkTree.call(this, this._data, -this.browserState.startLevel);

                this.showLevel(0);

                // the rest are actions...
                
                // we olways have to show the selected (if it's level is >= startlevel
                if (configuration.browserState[0].length) {
                    for (var i=0; i<configuration.browserState[0].length; i++) {
                       var node = this._nodeIndex[configuration.browserState[0][i]];
                        if (node && node.level >= 0) {
                            this.selectNode(node);   
                        }
                    }
                }


                var autoCollapse_ = this.autoCollapse;
                this.autoCollapse = false;

                // now we expand nodes
                if (configuration.browserState[1].length) {
                    for (var i=0; i<configuration.browserState[1].length; i++) {
                       var node = this._nodeIndex[configuration.browserState[1][i]];
                        if (node && node.level >= 0) {
                            this.expandNode(node);   
                        }
                    }
                }

                // now we mark nodes
                if (configuration.browserState[2].length) {
                    for (var i=0; i<configuration.browserState[2].length; i++) {
                       var node = this._nodeIndex[configuration.browserState[2][i]];
                        if (node && node.level >= 0) {
                            this.markNode(node);   
                            if (this.autoExpandMarked && node.parent)  this.expandNode(node.parent, this.autoExpandLevels);
                        }
                    }
                }

                this.autoCollapse = autoCollapse_;
            } else {
                this._data = null;
            }

            this.hidePleaseWait();
            this.underConstruction = false;

        }
    },

    setCanvas: function(canvas) {
        if (this._canvas != canvas) {
            if (this._canvas) this._erase();
            this._canvas = canvas;
//            var paperContainer = $('<div id="'+this._id+'_paper" class="PaperContainer"/>');
            this.paperContainer = $('<div id="paperContainer" class="PaperContainer"/>');

            canvas.append(this.paperContainer);

            this._paper = Raphael(this.paperContainer.attr("id"), canvas.width()-20, canvas.height());

            this._tb = $('<div id="'+this._id+'" class="TBrowser"/>');
            canvas.append(this._tb);
            canvas.disableSelection();   
            canvas._scrollable();

        }
    },

    getState: function() {
        return this.state;
    },

    drawPath: function() {


    }
}

/**
 * Class TBColumn
 */
$tb.TBColumn = function(browser, level) {
    this._id = "TBColumn-"+guid();

    //$.extend(this, new EventDispatcher());    

    this.browser = browser;
    this.level = level;

    this.panels = {};
    this.panelsByOrder = [];

    this.init(browser.browserState.foldedColumns.indexOf(level) > -1);

    trace("TBColumn ["+this._id+"] created.");
}

$tb.TBColumn.prototype = {
    _id: null,
    state: "UNFOLDED",

    browser: null,
    level: null,
    panels: null,
    skin: null,
    folderButton: null,
    panelHolder: null,
    panelsByOrder: null,

    width: 80,
    actualWidth: 80,
    height: 100,

    init: function(isFolded) {
        trace("Initializing column. isFolded is ["+isFolded+"]");

        var skin = $('<div/>', {
            id: this.browser._id+"_c"+(this.level),
            'class': "TBColumn"+((isFolded) ? " Folded" : ""),
            mouseover: function() {
                var self = $(this);
                
                var host = self.data("host");

                if (host.state == "FOLDED") {
                    self.addClass("UnFoldTagOn");
                    self.removeClass("UnFoldTagOff");
                }

            },
            mouseout: function() {
                var self = $(this);

                var host = self.data("host");

                if (host.state == "FOLDED") {
                    self.removeClass("UnFoldTagOn");
                    self.addClass("UnFoldTagOff");
                }

            },
            click: function() {
                var self = $(this);

                var host = self.data("host");

                if (host.state == "FOLDED") {
                    host.toggle();
                }
            }

           });

        skin.append('<div class="CanvasTest"/>');
        var folderButton = $('<div/>', {
            'class': "FolderButton",

            mouseover: function() {
                var self = $(this).parent();
                
                var host = self.data("host");

                if (host.state == "UNFOLDED") {
                    self.addClass("FoldTag");
                }
            },

            mouseout: function() {
                var self = $(this).parent();

                var host = self.data("host");

                if (host.state == "UNFOLDED") {
                    self.removeClass("FoldTag");
                }
             },
    
            click: function(e) {
                var self = $(this).parent();
                var host = self.data("host");
                host.toggle();
                self.removeClass("FoldTag");
                e.stopPropagation();
            }

        });
        
        skin.data("host", this);

        var panelHolder = $('<div/>', {
             'class': "PanelHolder"
        })
        
        skin.append(folderButton);
        
        this.folderButton = folderButton;

        skin.append(panelHolder);

        var container = $("#"+this.browser._id)[0];
        var nextColumn = $("#"+this.browser._id+"_c"+(this.level-1))[0];
  
        if (nextColumn) {
            skin.insertAfter(nextColumn);
        } else {
            skin.appendTo(container);
        }

        this.skin = skin;
        this.panelHolder = panelHolder;

    },

    getNode: function(node) {
        
        if (node) {

            var panelId = (node.parent) ? node.parent.id : -1;
            var nodePanel;

            if (this.panels[panelId]) {
                var nodePanel = this.panels[panelId];
            } else {
                nodePanel = new $tb.TBPanel(this, panelId);
                this.panels[panelId] = nodePanel;
            }
            
            return nodePanel.getNode(node);
        }
        

    },

    removeNode: function(node, isForced) {
        var result = [false, false, false];
        if (node) {

            var panelId = (node.parent) ? node.parent.id : -1;
            var nodePanel;

            if (this.panels[panelId]) {
                var nodePanel = this.panels[panelId];

                var result = nodePanel.removeNode(node, isForced);

                if (result[0]) {
                    // Panel was deleted
        
                    delete this.panels[panelId];

                    if (Object.size(this.panels)==0) {
                        this.skin.remove();
                        this.browser.recalculateHeight();
                        this.browser.checkWidth();

                        return [true, true, true];
                    } 

                    return [false, true, true];
                } else {
                    return [false].concat(result);
                }

            } else            
                return [false, false, false]; 
        }
        
        return result;
    },

    toggle: function() {
        if (this.state == "UNFOLDED") this.fold(); else this.unfold();
    },

    fold: function() {
        if (this.state != "UNFOLDED") return;

        trace("Folding ["+this._id+"]");
       
        this.folderButton.hide();
       
        this.browser.eraseConnectorsUntilLevel(this.level);

        this.width = this.skin.width();
        this.height = this.skin.height();

        this.state = "FOLDED";

        if (this.browser.animate) {
            this.skin.animate({
                width: '10',
                height: '90'
            }, 200, function() {
               if ($(this).data("host")) {
                   var browser = $(this).data("host").browser;
                   browser.recalculateHeight();
                   browser.checkWidth();
                   browser.drawConnectorsUntilLevel($(this).data("host").level);          
              }
            });

            this.panelHolder.animate({
                opacity: 0
            }, 200);
        } else {
            this.skin.width(10);
            this.skin.height(90);
            this.panelHolder.hide();
            this.browser.recalculateHeight();
            this.browser.checkWidth();
            
            this.browser.drawConnectorsUntilLevel(this.level);
        }
        
        this.skin.css("cursor", "e-resize");
        this.skin.addClass("UnFoldTagOff");

        if (this.browser.browserState.foldedColumns.indexOf(this.level) == -1)        
            this.browser.browserState.foldedColumns.push(this.level);
    },

    unfold: function() {
        if (this.state != "FOLDED") return;

        trace("Unfolding ["+this._id+"]");

        this.folderButton.show();

        this.browser.eraseConnectorsUntilLevel(this.level);

        this.browser.justUnfolded = this;

        this.state = "UNFOLDED";

        if (this.browser.animate) {
            this.skin.animate({
                width: this.width,
                height: this.height
            }, 200,  function() {
               if ($(this).data("host")) {
                   var browser = $(this).data("host").browser;
                   $(this).width("auto");
                   browser.recalculateHeight();
                   browser.checkWidth();
                   
                   browser.drawConnectorsUntilLevel($(this).data("host").level);

               }
            });
            this.panelHolder.animate({
                opacity: 1,
            }, 200);
        } else {
            this.skin.width("auto");
            this.skin.height(this.height);
            this.panelHolder.show();
            this.browser.recalculateHeight();
            this.browser.checkWidth();

            this.browser.drawConnectorsUntilLevel(this.level);
        }

        this.skin.css("cursor", "default");
        this.skin.removeClass("UnFoldTagOff");
        this.skin.removeClass("UnFoldTagOn");

        // var idx = this.browser.browserState.foldedColumns.indexOf(this.level);
        // if(idx!=-1) this.browser.browserState.foldedColumns.splice(idx, 1); // Remove it if really found!

        this.browser.browserState.foldedColumns.removeElement(this.level);
    },

    erase: function() {

    },

    considerWidth: function(aWidth) {
     /*   if (this.width < aWidth) {
            this.width = aWidth;
            if (this.state=="UNFOLDED") this.skin.width(aWidth);
        }*/
        this.browser.checkWidth();
    },

    recalculateHeight: function() {
           this.height = this.panelHolder.height()+25;
           if (this.state=="UNFOLDED") { 
               this.skin.height(this.height);
               this.browser.recalculateHeight();
           }
    }

}

/**
 * Class TBNodesPanel
 */
$tb.TBPanel = function(column, parentNodeId) {
    this._id = "TBPanel_"+parentNodeId;
    
    this.nodes = {};
    this.column = column;
    this.parentNodeId = parentNodeId;

    this.init(column.browser.browserState.packed);

    trace("TBPanel ["+this._id+"] created.");
}

$tb.TBPanel.prototype = {
    _id: null,
    column: null,
    state: "UNPACKED",
    parentNodeId: null,
    skin: null,
    label: null,
    labelContent: null,
    order: null,
    nodes: null,

    init: function(isPacked) {
        trace("Initializing panel. isPacked is ["+isPacked+"]");

        var skin = $('<div/>', {
            id: this.column._id+"_panelfor_"+(this.parentNodeId),
            'class': "TBPanel "+((isPacked) ? "Packed" : ""),

        });

        var panelLabel = (this.column.browser._nodeIndex[this.parentNodeId]) ? this.column.browser._nodeIndex[this.parentNodeId].name : null;
   
        if (panelLabel) {
            var label = $('<div/>', {
                'class': 'TBPanelLabel',
            });

            var labelContent = $('<span/>', {
                text: panelLabel
            });
            
            label.append(labelContent);
            skin.append(label);
            this.label = label;
        }

        skin.data("host", this);

        var container = this.column.panelHolder;

        this.skin = skin;
        this.labelContent = labelContent;

        if (this.parentNodeId != -1) {
            this.order = this.column.browser._nodeIndexesToLevels[this.column.level-1].indexOf(this.parentNodeId);
        } else {
            this.order = 0;
        }

                    
        if (this.column.panelsByOrder.length) { 
            for (var i in this.column.panelsByOrder) {
                var found = false;
                var theirOrder = this.column.panelsByOrder[i].order;
                if (theirOrder > this.order) {
                    found = true;
                    break;
                }
            }

            if (found) {
                skin.insertBefore(this.column.panelsByOrder[i].skin);
                this.column.panelsByOrder.splice(i,0,this);
            } else {
                skin.appendTo(container);
                this.column.panelsByOrder.push(this);
            }

        } else {
            skin.appendTo(container);
            this.column.panelsByOrder.push(this);
        }

        if (this.column.browser.animate) {
            skin.hide();
            skin.fadeIn(500);
        }

        this.refresh();

        this.column.browser._panels[this.parentNodeId] = this;
     

    },

    getNode: function (node) {
        
        if (node) {

            var tbNode;

            if (this.nodes[node.id]) {
                tbNode = this.nodes[node.id];
            } else {
                tbNode = new $tb.TBNode(this, node);
                this.nodes[node.id] = tbNode;
            }
            
            

            return tbNode;
        }

    },

    removeNode: function (node, isForced) {
        var result = [false, false];

        if (node) {

            var tbNode;

            if (this.nodes[node.id]) {
                tbNode = this.nodes[node.id];
                if( tbNode.remove(isForced)) {
                    delete this.nodes[node.id];
                    //trace(Object.size(this.nodes));

                    if (Object.size(this.nodes)==0) {
                        this.skin.remove();
                        delete this.column.browser._panels[this.parentNodeId];
                        this.column.panelsByOrder.removeElement(this);

                        result = [true, true];
                    } else {
                        result = [false, true];
                    }
                } else {
                   result = [false, true];
                }   

            } else {
                result = [false, false];
            }
            
            this.column.recalculateHeight();

        }
        
        return result;
    },

    refresh: function() {
        if (this.label && this.state == "UNPACKED") {
            this.label.show();
            this.skin.height(this.height+this.label.height());
            this.column.considerWidth(this.labelContent.width()+18);
        } else {
            this.label.hide();
            this.skin.height(this.height);
            this.column.considerWidth();            
        }
        this.column.recalculateHeight();        
        this.column.browser.drawConnectorsUntilLevel(this.column.level);
    }
}

/**
 * Class TBNode
 */
$tb.TBNode = function(panel, node) {
    this._id = "TBNode-"+node.id;
    this.node = node;
    this.panel = panel;

    this.activePathDirections = [];
    this.selectedPathDirections = [];


    this.state = {
        expandible: false,
        expanded: false,
        marked: false,
        selected: false,
        inSelectedPath: false,
        active: false,
        inActivePath: false,
    };

    this.init();
    
    trace("TBNode ["+this._id+"] created.");
}

$tb.TBNode.prototype = {
    _id: null,
    skin: null,
    node: null,
    panel: null,
    state: null,
    label: null,
    activeConnector: null,
    parentTBNode: null,
    activePathDirections: null,
    selectedPathDirections: null,
   
    init: function() {
            trace("Showing node ["+this.node.id+"].");

            state = this.state;

            var classString = "TBNode";

            var skin = $('<div/>', {
                id: "skinfor_"+(this.node.id),
                'class': classString,
                mouseover: function(e) {
                    //e.stopPropagation();
                    //var self = $(this);
                },
                mouseout: function(e) {
                   // e.stopPropagation();
                    //var self = $(this);
                },

                click: function(e) {
                    e.stopPropagation();
                    var self = $(this);
                    var host = self.data("host");

                    host.setActive();i

                    if (host.state.expanded) {
                        host.collapse();
                    } else if (host.state.expandible) {
                        host.expand(true);
                    }
                    
                },

            });
            
            this.skin = skin;

            this.skin.dblclick(function() {
                    var self = $(this);
                    var host = self.data("host");
                    
                    if (!host.state.selected) {
                        host.select();
                    } else {
                        host.deselect();
                    }

                }
            );

            var label = $('<div/>', {
                'class': 'TBNodeLabel',
            });

            this.label = label;

            skin.append(label);
            skin.data("host", this);

            skin.disableSelection();

            var container = this.panel.skin;

            if (this.node.parent) {
                
                var myPos = this.node.parent.children.indexOf(this.node);

                var afterSkin = null;
                for (var i in this.panel.nodes) {
                   var tbNode = this.panel.nodes[i];

                   if (this.node.parent.children.indexOf(tbNode.node)>myPos) {
                       afterSkin = tbNode.skin;
                   }
                }

                if (afterSkin) {
                   skin.insertBefore(afterSkin);
                } else {
                    skin.appendTo(container); 
                }
                
            } else {
                skin.appendTo(container); 
            }


            
            if (this.node.children.length) {
                this.state.expandible = true;
                skin.addClass('Expandible');
            }

            if (this.panel.column.browser.browserState.markedNodes.indexOf(this.node.id) != -1 ) {
                this.mark();
            } else {
                this.refresh();                
            }
            

            this.panel.column.considerWidth(label.width()+41);
            this.panel.column.recalculateHeight();

            this.panel.column.browser._tbNodes[this.node.id] = this;

            return this;
    },

    setActive: function() {
        if (!this.state.active) {
            if (this.panel.column.browser.activeTBNode) {
                this.panel.column.browser.activeTBNode.setInactive();
            }

            this.state.active = true;
            this.panel.column.browser.activeTBNode = this;

            if (this.node.parent) {
                var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                if (parentTBNode) {
                    this.parentTBNode = parentTBNode;
                    this.parentTBNode.setInActivePath(this);
                }
            }

            this.refresh();
        }
    },
    
    setInactive: function() {
        if (this.state.active) {
            this.state.active = false;
            this.panel.column.browser.activeTBNode = null;

            if (this.node.parent) {
                var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                if (parentTBNode) {
                    this.parentTBNode = parentTBNode;
                    this.parentTBNode.unsetInActivePath(this);
                }
            }
            
            this.refresh();
        }
    },


    setInActivePath: function(direction) {
        if (this.activePathDirections.indexOf(direction) == -1) {

            this.activePathDirections.push(direction);

            if (!this.state.inActivePath) {
                this.state.inActivePath = true;

                if (this.node.parent) {
                    var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                    if (parentTBNode) {
                        this.parentTBNode = parentTBNode;
                        this.parentTBNode.setInActivePath(this);
                    }
                }

                this.refresh();
            }

        }
    },
    
    unsetInActivePath: function(direction) {
        if (this.state.inActivePath) {        
            if (this.activePathDirections.indexOf(direction) > -1) {
            
                this.activePathDirections.removeElement(direction);

                if (!this.activePathDirections.length) {
                    this.state.inActivePath = false;
                    if (this.node.parent) {
                        var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                        if (parentTBNode) {
                            this.parentTBNode = parentTBNode;
                            this.parentTBNode.unsetInActivePath(this);
                        }
                    }
                    this.refresh();
                }
            }
        }
    },

    select: function() {
        if (!this.state.selected) {
            var browser = this.panel.column.browser;
            browser.beingSelected = this;
            if (browser.browserState.selectedNodes.length && !browser.allowMultipleSelected) {
                var tbNode = browser._tbNodes[browser.browserState.selectedNodes[0]];
                if (tbNode) {
                    tbNode.deselect();
                } else {
                   browser.browserState.selectedNodes.unshift(); 
                }
            }

            this.state.selected = true;
            this.panel.column.browser.browserState.selectedNodes.push(this.node.id);

            if (this.node.parent) {
                var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                if (parentTBNode) {
                    this.parentTBNode = parentTBNode;
                    this.parentTBNode.setInSelectedPath(this);
                }
            }

            browser.beingSelected = null;

            if (browser.autoCallBack) browser.callBack.call(browser.ctx, browser.getSelectedValues()); 
            this.refresh();
        }
    },
    
    deselect: function() {
        if (this.state.selected) {
            var browser = this.panel.column.browser;
            
            this.state.selected = false;
            this.panel.column.browser.browserState.selectedNodes.removeElement(this.node.id);

            var nodesToRemove = [];

            if (this.node.parent) {
                var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                if (parentTBNode) {
                    this.parentTBNode = parentTBNode;
                    nodesToRemove = this.parentTBNode.unsetInSelectedPath(this);
                }
            }
            
            this.refresh();

            if (this.panel.state == "PACKED") {
                this.panel.column.browser.removeNode(this.node);
            } 

            for (var i=nodesToRemove.length-1; i>=0; i--) this.panel.column.browser.removeNode(nodesToRemove[i]);
                
            if (!browser.beingSelected) if (browser.autoCallBack) browser.callBack.call(browser.ctx, browser.getSelectedValues()); 

        }
    },


    setInSelectedPath: function(direction) {
        if (this.selectedPathDirections.indexOf(direction) == -1) {

            this.selectedPathDirections.push(direction);

            if (!this.state.inSelectedPath) {
                this.state.inSelectedPath = true;

                if (this.node.parent) {
                    var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                    if (parentTBNode) {
                        this.parentTBNode = parentTBNode;
                        this.parentTBNode.setInSelectedPath(this);
                    }
                }
                this.refresh();
            }

        }
    },
    
    unsetInSelectedPath: function(direction) {
        var nodesToRemove = [];
        if (this.state.inSelectedPath) {        
            if (this.selectedPathDirections.indexOf(direction) > -1) {
            
                this.selectedPathDirections.removeElement(direction);

                if (!this.selectedPathDirections.length) {
                    this.state.inSelectedPath = false;
                    if (this.node.parent) {
                        var parentTBNode = this.panel.column.browser._tbNodes[this.node.parent.id];
                        if (parentTBNode) {
                            this.parentTBNode = parentTBNode;
                            var removeFromParents = this.parentTBNode.unsetInSelectedPath(this);
                            nodesToRemove = nodesToRemove.concat(removeFromParents);
                            
                        }
                    }

                    this.refresh();              

                    if (this.panel.state == "PACKED") {
                        nodesToRemove.push(this.node);
                    }
                    
                }
            }
        }

        return nodesToRemove;
    },


    expand: function(shouldScroll) {
        if (this.state.expandible) {
            trace("Expanding node ["+this.node.id+"]");

            var browser = this.panel.column.browser;

            for (var i = 0; i< this.node.children.length; i++) {
                browser.getNode(this.node.children[i]);
            }
            
            var childPanel = browser._panels[this.node.id];
            if (childPanel && childPanel.state == "PACKED") {
                childPanel.state = "UNPACKED";
                childPanel.refresh();
            }

            
            this.skin.removeClass("Expandible");
            this.skin.addClass("Expanded");


            this.state.expandible = false;
            this.state.expanded = true;

            if (browser.browserState.expandedNodes.indexOf(this.node.id) == -1) {
                browser.browserState.expandedNodes.push(this.node.id);

            }

            if (browser._columns[this.node.level+1]) {
                browser._columns[this.node.level+1].unfold();
            }


            // autofold
/*            if (browser._columns.length-browser.browserState.foldedColumns.length > browser.maxColumns) {
                
                for (var i=0; i<browser._columns.length; i++) {
                    if (browser._columns[i].state == "UNFOLDED" && browser._columns[i] != this.panel.column) {
                       browser._columns[i].fold();
                       break;
                    }
                }

            } */
    
            //autocollapse
            if (browser.autoCollapse) {
                // collapse all other on my level
                for (var i=0; i<browser._nodesToLevels[this.node.level].length; i++) {
                    var otherNode = browser._nodesToLevels[this.node.level][i];
                    if (otherNode != this.node && browser._tbNodes[otherNode.id]) browser.collapseNode(otherNode);
                }
            }

//            browser.eraseConnectorsUntilLevel(this.panel.column.level);
            browser.drawConnectorsUntilLevel(this.panel.column.level);

            if (shouldScroll && browser.autoScroll) {
                if (isSet(browser._panels[this.node.id])) browser._canvas.scrollTo(browser._panels[this.node.id].skin);
                //$('body').scrollTo(browser._panels[this.node.id].skin);
            }

            this.panel.column.recalculateHeight();

        }
    },

    collapse: function() {
        if (this.state.expanded) {
            trace("Collapsing node ["+this.node.id+"]");
            var browser = this.panel.column.browser;

            var wasPanelRemoved = false;

            for (var i = 0; i< this.node.children.length; i++) {
               wasPanelRemoved = browser.removeNode(this.node.children[i])[1];
            }
            
            var myPanel = browser._panels[this.node.id];

            if (wasPanelRemoved) {
            } else {
                if (myPanel) {
                    myPanel.state = "PACKED";
                    myPanel.refresh();
                }
            }
        
            this.skin.removeClass("Expanded");
            this.skin.addClass("Expandible");

            this.state.expanded = false;
            this.state.expandible = true;
            browser.browserState.expandedNodes.removeElement(this.node.id);
       }
    },

    mark: function() {
       if (!this.state.marked) {
            this.state.marked = true;
            this.refresh();
       }
    },

    unmark: function() {
        if (this.state.marked) {
            this.state.marked = false;
            this.refresh();
        }
    },

    refresh: function() {
        if (this.state.marked || this.node.markedPopulation > 0) {
            var summa;
 
            if (this.state.marked) {
                summa = this.node.cumulatedPopulation;
            } else {
                summa = this.node.markedPopulation;
            }

            this.label.html(this.node.name+'<div class="Hits">['+summa+']');
            this.skin.width(this.label.width()+8);
        } else {
            this.label.text(this.node.name);
            this.skin.width(this.label.width()+8);
        }

        if (this.state.marked) {
            this.skin.addClass("Marked");
        } else {
           this.skin.removeClass("Marked");
           if (this.node.markedPopulation > 0) {
                this.skin.addClass("ComeToDiscover");           
           } else {
                this.skin.removeClass("ComeToDiscover");           
           }
       }

       if (this.state.active || this.state.inActivePath) {
            if (this.state.active) this.skin.addClass("Active");
            if (this.state.inActivePath) this.skin.addClass("InActivePath");
            if (!this.activeConnector) this.activeConnector = new $tb.TBConnector(this.panel.column.browser, this, "ACTIVE_PATH");
            this.activeConnector.draw(); 
       } else {
            if (!this.state.active) this.skin.removeClass("Active");
            if (!this.state.inActivePath) this.skin.removeClass("InActivePath");
            if (this.activeConnector) this.activeConnector.erase();
       }

       if (this.state.selected || this.state.inSelectedPath) {
            if (this.state.selected) this.skin.addClass("Selected");
            if (this.state.inSelectedPath) this.skin.addClass("InSelectedPath");
            if (!this.selectedConnector) this.selectedConnector = new $tb.TBConnector(this.panel.column.browser, this, "SELECTED_PATH");
            this.selectedConnector.draw(); 
       } else {
            if (!this.state.selected) this.skin.removeClass("Selected");
            if (!this.state.inSelectedPath) this.skin.removeClass("InSelectedPath");
            if (this.selectedConnector) this.selectedConnector.erase();
       }
       
    },

    eraseConnectorsUntilLevel: function(level) {
        if (this.panel.column.level >= level) {
            if (this.activeConnector) this.activeConnector.erase();
            if (this.selectedConnector) this.selectedConnector.erase();
            if (this.parentTBNode) this.parentTBNode.eraseConnectorsUntilLevel(level);
        }
    },

    drawConnectorsUntilLevel: function(level) {
        if (this.panel.column.level >= level) {
            if (this.activeConnector) this.activeConnector.draw();
            if (this.selectedConnector) this.selectedConnector.draw();
            if (this.parentTBNode) this.parentTBNode.drawConnectorsUntilLevel(level);
        }
    },

    remove: function(isForced) {
        if (isForced == true || (this.state.selected == false && this.state.inSelectedPath == false)) {
            
            var browser = this.panel.column.browser;

            this.setInactive();

            if (this.state.expanded) {

                for (var i = 0; i< this.node.children.length; i++) {
                    browser.removeNode(this.node.children[i]);
                }
            }



            this.skin.remove();

            delete browser._tbNodes[this.node.id];
            return true;
        } else {
            this.collapse();
            return false;
        }
    }
    
}

/**
 * Class TBConnector
 */
$tb.TBConnector = function(browser, ownerTBNode, style) {
    this._id = "TBConnector"+guid();

    this.browser = browser;
    this.ownerTBNode = ownerTBNode;
    this.style = style;

    trace("TBConnector ["+this._id+"] created.");
}

$tb.TBConnector.prototype = {
    _id: null,
    browser: null,
    style: null,
    ownerNode: null,
    
    sprite:null,

    draw: function() {
        trace("Drawing Connector for ["+this.ownerTBNode.node.id+"]");
        if (this.sprite) {
            this.sprite.remove();
        }
    
        if (this.ownerTBNode.parentTBNode && this.ownerTBNode.panel.column.state == "UNFOLDED") {
        
            var firstVisibleParent = this.ownerTBNode.parentTBNode;
            while (firstVisibleParent && firstVisibleParent.panel.column.state != "UNFOLDED") {
                firstVisibleParent = firstVisibleParent.parentTBNode;
            }
            
            if (firstVisibleParent) {
                var p1 = firstVisibleParent.skin.position();
                var p2 = this.ownerTBNode.skin.position();

                p1.left += firstVisibleParent.skin.outerWidth();
                p1.top += firstVisibleParent.skin.outerHeight()/2;

                p2.top += this.ownerTBNode.skin.outerHeight()/2;

                switch(this.style) {
                    
                    case "ACTIVE_PATH":
                            
                            // Bezier
                            // var c1 = {
                            //     top: p1.top,
                            //     left: p1.left+40
                            // };

                            // var c2 = {
                            //     top: p2.top,
                            //     left: p2.left-40   
                            // };

                            // var path = "M"+p1.left+" "+p1.top+"L"+(p1.left+5)+" "+p1.top+" C"+c1.left+" "+c1.top+" "+c2.left+" "+c2.top+" "+(p2.left-5)+" "+p2.top+" L"+(p2.left)+" "+p2.top; 

                            // Straight
                            var path = "M"+p1.left+" "+(p1.top)+"L"+(p1.left+5)+" "+(p1.top)+" L"+(p2.left-5)+" "+(p2.top)+" L"+(p2.left)+" "+(p2.top); 
                            
                            this.sprite = this.browser._paper.path(path);

                            this.sprite.attr({
                                stroke: "#999",
                                "stroke-dasharray": "-"
                            });

                            break;
                    

                    case "SELECTED_PATH":
                            
                            var path = "M"+p1.left+" "+(p1.top)+"L"+(p1.left+5)+" "+(p1.top)+" L"+(p2.left-5)+" "+(p2.top)+" L"+(p2.left)+" "+(p2.top); 
                            
                            this.sprite = this.browser._paper.path(path);

                            this.sprite.attr({
                                stroke: "#FF0066"
                             });

                            break;

                }
            }
        }
    },

    erase: function () {
        if (this.sprite) {
            this.sprite.remove();
        }
    },

}



/**
 * Class TBrowsetState
 */
$tb.TBRowserState = function(selected, expanded, marked, folded, startLevel, endLevel) {
    this._id = "TBRowserState-"+guid();
    
    if (isSet(selected)) this.selectedNodes = selected;
    if (isSet(expanded)) this.expandedNodes = expanded;
    if (isSet(marked)) this.marked = marked;
    if (isSet(folded)) this.folded = folded;
    if (isSet(startLevel)) this.startLevel = startLevel;

    trace("TBRowserState ["+this._id+"] created.");
}

$tb.TBRowserState.prototype = {
    selectedNodes: [],                // there can be only one selected
    expandedNodes: [],                 // which nodes are expanded
    markedNodes: [],
    foldedColumns: [],                 // list of folded columns
    startLevel: 0,
    packed: false,
}
