NODE_WIDTH = 140;
NODE_HEIGHT = 35;
NODE_COLOR = '#808080';
NODE_HIGHLIGHT_COLOR = '#C0C0C0';
NEW_NODE_COLOR = 'rgba(128, 128, 128, 0.5)';
NODE_HIGHLIGHT_COLOR = '#C0C0C0';
SHELF_NODE_SPACING = 5;
CONNECTOR_HEIGHT = 8;
CONNECTOR_SPACING = 2;
CONNECTOR_COLOR = '#808000';
CONNECTOR_HIGHLIGHT_COLOR = '#FFFF00';
MIN_BEZIER_OFFSET = 50;

function HoverManipulator(schematic) {
    this.schematic = schematic;
    this.currentItem = null;
    this.onMouseMove = function(x, y) {
        var picked = this.schematic.pick(x, y);
        if (picked == this.currentItem) return;
        if (this.currentItem) this.currentItem.isHighlit = false;
        this.currentItem = picked;
        if (this.currentItem) this.currentItem.isHighlit = true;
        this.schematic.invalidate();
    }
    this.onMouseDown = function(x, y) {
        if (this.currentItem) {
            this.schematic.currentManipulator = this.currentItem.onBeginDrag(this.schematic);
            this.schematic.currentManipulator.onMouseDown(x, y);
        }
    }
    this.onMouseUp = function(x, y) {
    }
    this.draw = function(ctx) {
    }
}

function DragManipulator(schematic) {
    this.schematic = schematic;
    this.node = null;
    this.onMouseMove = function(x, y) {
        this.node.x += (x - this.prevX);
        this.node.y += (y - this.prevY);
        this.prevX = x;
        this.prevY = y;
        this.schematic.invalidate();
    }
    this.onMouseDown = function(x, y) {
        this.node = this.schematic.pick(x, y);
        this.prevX = x;
        this.prevY = y;
    }
    this.onMouseUp = function(x, y) {
        this.schematic.currentManipulator = new HoverManipulator(this.schematic);
    }
    this.draw = function(ctx) {
    }
}

function CreateAndDragManipulator(schematic, shelfNode) {
    this.schematic = schematic;
    this.shelfNode = shelfNode;
    this.node = this.target = null;
    this.onMouseMove = function(x, y) {
        if (!this.node) {
            this.node = this.schematic.createNode(this.shelfNode);
            this.node.color = NEW_NODE_COLOR;
        } else {
            this.node.x += (x - this.prevX);
            this.node.y += (y - this.prevY);
            schematic.removeNode(this.node);
            var target = schematic.pick(x, y);
            schematic.addNode(this.node);
            if (this.target) this.target.isHighlit = false;
            this.target = target;
            if (this.target) this.target.isHighlit = true;
        }
        this.prevX = x;
        this.prevY = y;
        this.schematic.invalidate();
    }
    this.onMouseDown = function(x, y) {
        this.prevX = x;
        this.prevY = y;
    }
    this.onMouseUp = function(x, y) {
        if (this.node) {
            var dropInput = this.target ? this.target.getDropInput() : null;
            if (dropInput) {
                if (schematic.onCreateNode) schematic.onCreateNode(this.node, this.shelfNode);
                if (dropInput.source && this.node.inputs.length > 0) {
                    this.schematic.link(dropInput.source, this.node.inputs[0]);
                }
                if (this.node.outputs.length > 0) this.schematic.link(this.node.outputs[0], dropInput);
                this.node.color = NODE_COLOR;
            } else {
                this.schematic.removeNode(this.node);
                this.node = null;
            }
        }
        this.schematic.invalidate();
        this.schematic.currentManipulator = new HoverManipulator(this.schematic);
    }
    this.draw = function(ctx) {
    }
}

function LinkManipulator(schematic, source) {
    this.schematic = schematic;
    this.source = source;
    this.source.isHighlit = true;
    this.startX = source.node.x + source.x + source.width / 2;
    this.startY = source.node.y + source.y + source.height / 2;
    this.onMouseMove = function(x, y) {
        this.endX = x;
        this.endY = y;
        var destination = this.schematic.pick(x, y);
        if (this.destination) this.destination.isHighlit = false;
        if (destination && destination.wouldLink(source) && source.wouldLink(destination)) {
            destination.isHighlit = true;
            this.destination = destination;
        } else {
            this.destination = null;
        }
        this.schematic.invalidate();
    }
    this.onMouseDown = function(x, y) {
    }
    this.onMouseUp = function(x, y) {
        this.source.isHighlit = false;
        this.schematic.currentManipulator = new HoverManipulator(this.schematic);
        if (this.source && this.destination) {
            this.schematic.link(this.source, this.destination);
        }
        this.schematic.invalidate();
    }
    this.draw = function(ctx) {
        ctx.strokeStyle = CONNECTOR_HIGHLIGHT_COLOR;
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        var offset = Math.abs(this.endY - this.startY);
        if (offset < MIN_BEZIER_OFFSET) offset = MIN_BEZIER_OFFSET;
        if (!this.source.isOutput) {
            offset = -offset;
        }
        ctx.bezierCurveTo(this.startX, this.startY + offset, this.endX, this.endY - offset, this.endX, this.endY);
        ctx.stroke();
    }
}

function Node(id, x, y, color, highlightColor, inputs, outputs) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.color = color;
    this.highlightColor = highlightColor;
    this.width = NODE_WIDTH;
    this.height = NODE_HEIGHT;
    this.isHighlit = false;
    this.inputs = [];
    this.outputs = [];
    for (var i in inputs) {
        var inputConnectorWidth = this.width / inputs.length - CONNECTOR_SPACING * (inputs.length - 1);
        this.inputs.push(new InputConnector(this, inputs[i], i * (inputConnectorWidth + CONNECTOR_SPACING), 0, inputConnectorWidth, CONNECTOR_HEIGHT));
    }
    for (var i in outputs) {
        var outputConnectorWidth = this.width / outputs.length - CONNECTOR_SPACING * (outputs.length - 1);
        this.outputs.push(new OutputConnector(this, outputs[i], i * (outputConnectorWidth + CONNECTOR_SPACING), this.height - CONNECTOR_HEIGHT, outputConnectorWidth, CONNECTOR_HEIGHT));
    }
    this.pick = function(x, y) {
        if (x < this.x || y < this.y || x >= this.x + this.width || y >= this.y + this.height)
            return null;
        for (var i in this.inputs) {
            if (this.inputs[i].pick(x - this.x, y - this.y))
                return this.inputs[i];
        }
        for (var i in this.outputs)
            if (this.outputs[i].pick(x - this.x, y - this.y))
                return this.outputs[i];
        return this;
    }

    this.draw = function(ctx) {
        ctx.fillStyle = this.isHighlit ? this.highlightColor : this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        var textSize = ctx.measureText(this.id);
        var x = this.x + (this.width - textSize.width) / 2;
        var y = this.y + (this.height + 8) / 2;
        ctx.fillStyle = "black";
        ctx.fillText(id, x + 1, y + 1);
        ctx.fillStyle = "white";
        ctx.fillText(id, x, y);
        ctx.save();
        ctx.translate(this.x, this.y);
        for (var i in this.inputs) {
            this.inputs[i].draw(ctx);
        }
        for (var i in this.outputs) {
            this.outputs[i].draw(ctx);
        }
        ctx.restore();
    }
    this.onBeginDrag = function(schematic) {
        return new DragManipulator(schematic);
    }
    this.wouldLink = function(connector) {
        return false;
    }
    this.getDropInput = function() {
        return this.inputs.length > 0 ? this.inputs[0] : null;
    }
}

function ShelfNode(id, x, y, inputs) {
    Node.call(this, id, x, y, NODE_COLOR, NODE_HIGHLIGHT_COLOR, [], []);
    this.origInputs = inputs;
    this.onBeginDrag = function(schematic) {
        this.isHighlit = false;
        return new CreateAndDragManipulator(schematic, this);
    }
    this.createNode = function() {
        var node = new Node(this.id, this.x, this.y, NODE_COLOR, NODE_HIGHLIGHT_COLOR, this.origInputs, ["result"]);
        return node;
    }
}

function Connector(node, id, x, y, width, height) {
    this.node = node;
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isHighlit = false;
    this.draw = function(ctx) {
        ctx.fillStyle = this.isHighlit ? CONNECTOR_HIGHLIGHT_COLOR : CONNECTOR_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        if (this.isHighlit) {
            var dims = ctx.measureText(this.id);
            var x = this.x + (this.width - dims.width) / 2;
            ctx.fillStyle = "#0000C0";
            ctx.fillRect(x, this.y + 5, dims.width + 4, 15);
            ctx.fillStyle = "white";
            ctx.fillText(id, x, this.y + 15);
        }
    }
    this.pick = function(x, y) {
        return (x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height);
    }
    this.onBeginDrag = function(schematic) {
        return new LinkManipulator(schematic, this);
    }
}

function InputConnector(node, id, x, y, width, height) {
    Connector.call(this, node, id, x, y, width, height);
    this.source = null;
    this.isOutput = false;
    this.wouldLink = function(connector) {
        return connector.isOutput;
    }
    this.getDropInput = function() {
        return this;
    }
}

function OutputConnector(node, id, x, y, width, height) {
    Connector.call(this, node, id, x, y, width, height);
    this.isOutput = true;
    this.wouldLink = function(connector) {
        return !connector.isOutput;
    }
    this.getDropInput = function() {
        return null;
    }
}

function Link(source, destination) {
    this.source = source;
    this.destination = destination;
    this.isHighlit = false;
    this.drawPath = function(ctx) {
        ctx.beginPath();
        var startX = this.source.node.x + this.source.x + this.source.width / 2;
        var startY = this.source.node.y + this.source.y + this.source.height / 2;
        var endX = this.destination.node.x + this.destination.x + this.destination.width / 2;
        var endY = this.destination.node.y + this.destination.y + this.destination.height / 2;
        ctx.moveTo(startX, startY);
        var offset = Math.abs(endY - startY);
        if (offset < MIN_BEZIER_OFFSET) offset = MIN_BEZIER_OFFSET;
        ctx.bezierCurveTo(startX, startY + offset, endX, endY - offset, endX, endY);
    }
    this.draw = function(ctx) {
        ctx.strokeStyle = this.isHighlit ? CONNECTOR_HIGHLIGHT_COLOR : CONNECTOR_COLOR;
        this.drawPath(ctx);
        ctx.stroke();
    }
    this.pick = function(ctx, x, y) {
        this.drawPath(ctx);
        return ctx.isPointInPath(x, y) ? this : null;
    }
    this.getDropInput = function() {
        return this.destination;
    }
    this.wouldLink = function(connector) {
        return false;
    }
}

function Schematic(width, height) {
    this.width = width;
    this.height = height;
    this.currentManipulator = new HoverManipulator(this);
    this.onInvalidate = null;
    this.nodes = [];
    this.links = [];
    this.shelfNodeY = 0;
    this.createNode = function(shelfNode) {
        var node = shelfNode.createNode();
        var i = 1;
        var id;
        do {
          id = shelfNode.id + i;
          i++;
        } while (this.findNodeById(id));
        node.id = id;
        this.nodes.push(node);
        return node;
    }
    this.addNode = function(node) {
        this.nodes.push(node);
        if (this.onAddNode) this.onAddNode(node);
    }
    this.removeNode = function(node) {
        this.nodes = this.nodes.filter(function(v) { return v != node; });
        if (this.onRemoveNode) this.onRemoveNode(node);
    }
    this.link = function(output, input) {
        if (!output.isOutput) {
            var tmp = output;
            output = input;
            input = tmp;
        }
        if (input.source) this.unlink(input);
        var link = new Link(output, input);
        input.source = output;
        this.links.push(link);
        if (this.onLink) this.onLink(output, input);
    }
    this.unlink = function(input) {
        this.links = this.links.filter(function(v) { return v.destination != input; });
    }
    this.addShelfNode = function(id, inputs) {
        var node = new ShelfNode(id, this.width - NODE_WIDTH, this.shelfNodeY, inputs);
        this.addNode(node);
        this.shelfNodeY += node.height + SHELF_NODE_SPACING;
        return node;
    }
    this.onMouseMove = function(x, y) { this.currentManipulator.onMouseMove(x, y); }
    this.onMouseDown = function(x, y) { this.currentManipulator.onMouseDown(x, y); }
    this.onMouseUp = function(x, y) { this.currentManipulator.onMouseUp(x, y); }
    this.pick = function(x, y) {
        for (var i in this.nodes) {
            var node = this.nodes[i];
            var item = node.pick(x, y);
            if (item) return item;
        }
        for (var i in this.links) {
            var link = this.links[i];
            var item = link.pick(ctx, x, y);
            if (item) return item;
        }
        return null;
    }
    this.findNodeById = function(id) {
        for (var i in this.nodes) {
            var node = this.nodes[i];
            if (node.id == id) return node;
        }
        return null;
    }
    this.draw = function(ctx) {
        for (var i in this.links) {
            this.links[i].draw(ctx);
        }
        for (var i in this.nodes) {
            this.nodes[i].draw(ctx);
        }
        ctx.strokeStyle = "white";
        var x = this.width - NODE_WIDTH - 5;
        var y = this.shelfNodeY;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, y);
        ctx.lineTo(this.width - 1, y);
        ctx.stroke();
        this.currentManipulator.draw(ctx);
    }
    this.invalidate = function() {
        if (this.onInvalidate) this.onInvalidate();
    }
}
