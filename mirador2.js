(function() {
  'use strict';

  // Mirador 2: This recipe does the following:
    // detect when item pages have valid IIIF responses and insert Mirador button when they do
    // load CSS and Mirador JS dependencies when the user clicks the Mirador button
    // open current item IIIF manifest in a new window with a custom page containing the Mirador viewer

  function loadScript(src) {
    // helper function to load js file and insert into DOM
    // @param {string} src link to a js file
    // @returns Promise
    return new Promise(function(resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const currentUrl = window.location.origin
    ? `${window.location.origin}/`
    : `${window.location.protocol}//${window.location.host}/`;

  // helper function to determine parent record ID of current item
	function getParent(item, collection) {
    return fetch(`/digital/bl/dmwebservices/index.php?q=GetParent/${collection}/${item}/json`)
    .then((response) => response.json())
		// make GetParent API call and return as JSON
    .then((json) => {
      let parent = false;
      // parse JSON for 'parent' value; -1 indicates parent ID is the same as item ID
      if (json.parent === -1) {
        parent = item;
      } else {
        parent = json.parent;
      }
      return parent;
    })
    .then((parent) => {
    // once parent is known, check if IIIF Pres manifest exists
      return fetch(`/iiif/info/${collection}/${parent}/manifest.json`)
      .then((response) => {
        if (response.status != 200) {
          console.log('No IIIF manifest exists for this record.');
          parent = false;
          // if no manifest exists, return is 'false' so that IIIF button is not inserted
          return parent;
        } else {
          // check if manifest is for single-item PDF
          return fetch(`/digital/api/collections/${collection}/items/${parent}/false`)
          .then((response) => response.json())
          .then((json) => {
            if (json.filename.split('.').pop() === 'pdf' ) {
            // if item format is pdf return is false so that IIIF button is not inserted
              console.log('pdf?',json.filename.split('.').pop());
              parent = false;
              return parent;
            } else {
              return parent;
            }
          })
          .catch((error) => console.log('Item API request failed.', error));
        }
      })
      .catch((error) => {
        console.log('Manifest request failed.', error);
        parent = false;
        return parent;
      });
    })
    .catch(function(error) {
      console.log('GetParent request failed.', error);
      parent = false;
      return parent;
		});
	}

  const mirador_button = {
    getMiradorUrl: function(item, collection) {
      const manifestUrl = `${currentUrl}/iiif/info/${collection}/${item}/manifest.json`;
      return `/digital/custom/mirador?manifest=${manifestUrl}`;
    },
    add: function(item, collection) {
      const div = document.createElement('div')
      div.className = 'btn-group btn-group-default mirador-button';

      const buttonAnchor = document.createElement('a');
      buttonAnchor.title = "View this item in Mirador";
      buttonAnchor.className = 'cdm-btn btn btn-primary';
      buttonAnchor.href = mirador_button.getMiradorUrl(item, collection);
      buttonAnchor.style.paddingTop = '5px';
      buttonAnchor.style.paddingBottom = '2px';
      buttonAnchor.target = '_blank';
      buttonAnchor.innerHTML = ' <svg xmlns="http://www.w3.org/2000/svg" height="1.8em" viewBox="0 0 60 55" style="fill: currentColor;"><rect width="18" height="55" /><rect width="18" height="55" transform="translate(42)" /><rect width="18" height="34" transform="translate(21)" /></svg> ';

      div.appendChild(buttonAnchor);

      Array.from(document.querySelectorAll('.ItemOptions-itemOptions>.btn-toolbar'))
      .forEach(el => {
        el.appendChild(div.cloneNode(true));
      });
    },
    remove: function() {
      Array.from(document.querySelectorAll('.mirador-button'))
      .forEach(el => {
        if (el && el.parentElement) {
          el.parentElement.removeChild(el);
        }
      });
    }
  }

  const addMiradorCss = function () {
    const cssId = 'mirador'; // you could encode the css path itself to generate id
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/customizations/global/pages/mirador/css/mirador-combined.css';
      link.media = 'all';
      document.head.appendChild(link);
    }
  }

  const initMirador = function () {
    let query = {};
    location.search.split(/\&|\?/g).forEach(function(it) {
      if (it) {
        const parts = it.split('=');
        const key = parts[0];
        const value = parts[1];
        query[key] = value;
      }
    });

    let options = {
      id: 'viewer',
      data: [],
      buildPath: '/customizations/global/pages/mirador/'
    };
    if (query['manifest']) {
      options.data.push({
        manifestUri: query['manifest'],
        location: query['collection'] || ''
      });

      options.windowObjects = [{
        loadedManifest: query['manifest'],
        canvasID: query['canvas'] || ''
      }];
    }

    Mirador(options);
  }

  let globalScope = true;
  let collectionScope = [
    'example_alias1',
    'example_alias2'
  ]

  document.addEventListener('cdm-item-page:ready', function(e) {
    const item = e.detail.itemId;
		const collection = e.detail.collectionId;
    if (globalScope || collectionScope.includes(collection)) {
    	getParent(item, collection).then(function(response) {
    		if (response === false) { return; } else {
          mirador_button.add(response, collection);
        }
      });
    }
  });

  document.addEventListener('cdm-item-page:update', function(e) {
    const item = e.detail.itemId;
    const collection = e.detail.collectionId;
    if (globalScope || collectionScope.includes(collection)) {
      getParent(item, collection).then(function(response) {
        mirador_button.remove();
        if (response === false) {
          return;
        } else {
          mirador_button.add(response, collection);
        }
      });
    }
  });

  document.addEventListener('cdm-item-page:leave', function(e) {
    const collection = e.detail.collectionId;
    if (globalScope || collectionScope.includes(collection)) {
      mirador_button.remove();
    }
  });

  document.addEventListener('cdm-custom-page:ready', function(e) {
    if (e.detail.filename == 'mirador') {
      addMiradorCss();
      loadScript('/customizations/global/pages/mirador/mirador.js')
      .then(function() {
        initMirador();
      });
    }
  });

})();
(function () {
    'use strict';

    const currentUrl = window.location.origin ?
        window.location.origin + '/' :
        window.location.protocol + '//' + window.location.host;

    const logoSvgIIIF = '<svg height="2em" width="2em" style="margin-bottom:-5px;" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" style="enable-background:new" version="1.1" id="svg2" xml:space="preserve" width="586.95789" height="534.94623" viewBox="0 0 586.95789 534.94622"> <metadata id="metadata8"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format><dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" /><dc:title></dc:title></cc:Work></rdf:RDF></metadata><defs id="defs6" /><g style="display:inline" id="g10" transform="matrix(1.3333333,0,0,-1.3333333,42.08939,487.43895)"> <g style="display:inline;" id="layer4"><rect ry="56.48138" transform="scale(1,-1)" y="-354.32922" x="-20.317043" height="378.70969" width="417.71841" id="rect2281" style="opacity:1;fill:#ffffff;fill-opacity:1;stroke:#ffffff;stroke-width:22.5;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1" /> </g><g id="g12" transform="scale(0.1)"><path d="M 65.2422,2178.75 775.242,1915 773.992,15 65.2422,276.25 v 1902.5" style="fill:#2873ab;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path14" /><path d="m 804.145,2640.09 c 81.441,-240.91 -26.473,-436.2 -241.04,-436.2 -214.558,0 -454.511,195.29 -535.9527,436.2 -81.4335,240.89 26.4805,436.18 241.0387,436.18 214.567,0 454.512,-195.29 535.954,-436.18" style="fill:#2873ab;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path16" /><path d="M 1678.58,2178.75 968.578,1915 969.828,15 1678.58,276.25 v 1902.5" style="fill:#ed1d33;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path18" /><path d="m 935.082,2640.09 c -81.437,-240.91 26.477,-436.2 241.038,-436.2 214.56,0 454.51,195.29 535.96,436.2 81.43,240.89 -26.48,436.18 -241.04,436.18 -214.57,0 -454.52,-195.29 -535.958,-436.18" style="fill:#ed1d33;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path20" /><path d="m 1860.24,2178.75 710,-263.75 -1.25,-1900 -708.75,261.25 v 1902.5" style="fill:#2873ab;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path22" /><path d="m 2603.74,2640.09 c 81.45,-240.91 -26.47,-436.2 -241.03,-436.2 -214.58,0 -454.52,195.29 -535.96,436.2 -81.44,240.89 26.48,436.18 241.03,436.18 214.57,0 454.51,-195.29 535.96,-436.18" style="fill:#2873ab;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path24" /><path d="m 3700.24,3310 v -652.5 c 0,0 -230,90 -257.5,-142.5 -2.5,-247.5 0,-336.25 0,-336.25 l 257.5,83.75 V 1690 l -258.61,-92.5 V 262.5 L 2735.24,0 v 2360 c 0,0 -15,850 965,950" style="fill:#ed1d33;fill-opacity:1;fill-rule:nonzero;stroke:none" id="path26" /></g></g></svg>';

    // Determine if current item has a parent
    function getParent(item, collection) {
        let ids = {parent: null};
        return fetch(`/digital/bl/dmwebservices/index.php?q=GetParent/${collection}/${item}/json`)
        .then(function(response) {
            return response.json();
        })
        .then(function(json) {
            // parse JSON for 'parent' value; -1 indicates parent ID is the same as item ID
            if (json.parent === -1) {
                ids.parent = item;
            } else {
                ids.parent = json.parent;
            }
            return ids;
        })
        .catch(function(error) {
            console.log('Parent request failed: ' + error);
            return false;
        })
    }

    // Determine if IIIF manifest exists. If it does, parse the first child from the first canvas
    function checkManifest(ids, collection) {
        return fetch(`/iiif/info/${collection}/${ids.parent}/manifest.json`)
        .then(function(response) {
            if (response.status == 404) {
                console.info(`No IIIF manifest exists for this record (id=${ids.parent}).`);
                // if no manifest exists, return is 'false' so that IIIF button is not inserted
                return false;
            } else {
                return response.json();
            }
        })
        .then(function(json) {
            let manifestData = json
            let hasFirstChild = !!manifestData.sequences[0].canvases[0]['@id']
            if(hasFirstChild) {
                let canvases = manifestData.sequences[0].canvases
                let allChildren = []
                for (let n=0; n < canvases.length; n++) {
                    let nthChildCanvas = canvases[n]['@id']
                    let collStartIndex = nthChildCanvas.indexOf(collection)
                    let itemStartIndex = collStartIndex + collection.length + 1
                    let itemEndIndex = nthChildCanvas.indexOf('/canvas/')
                    let nthChildId = nthChildCanvas.slice(itemStartIndex, itemEndIndex)
                    if( n === 0) {
                        ids.child = nthChildId
                    }
                    allChildren.push(nthChildId)
                }
                ids = {...ids, allChildren: allChildren}

            } else {
                ids.child = null
                ids.allChildren = null
            }

            return ids;
        })
        .catch(function(error) {
            console.log('Manifest request failed: ' + error);
            return false;
        })
    }

    function newMetadataRow(rowClass, labelText, valueContents) {
        //helper function to build HTML for new row of metadata with field label and contents
        let rowContainer = document.createDocumentFragment();
        let fieldRow = document.createElement('tr');
        fieldRow.classList.add('ItemMetadata-metadatarow', rowClass);
        let fieldLabel = document.createElement('td');
        fieldLabel.classList.add('ItemMetadata-key','field-label');
        fieldLabel.style.verticalAlign = 'bottom';
        fieldLabel.innerHTML = labelText;
        let fieldValue = document.createElement('td');
        fieldValue.classList.add('field-value');
        let fieldValueSpan = document.createElement('span');
        fieldValueSpan.classList.add('field-value-span');
        fieldValueSpan.appendChild(valueContents);
        fieldValue.appendChild(fieldValueSpan);
        fieldRow.appendChild(fieldLabel);
        fieldRow.appendChild(fieldValue);
        rowContainer.appendChild(fieldRow);
        return rowContainer;
    }

    const fieldIiifManifest = {
        insertManifestLink: function(item,parent,child,allChildren,collection) {

            const objectDescriptionTable = document.querySelector('div#compoundObjectDescription>div>table>tbody');
            const itemDescriptionTable = document.querySelector('div#compoundItemDescription>div>table>tbody');
            const singleItemDescriptionTable = document.querySelector('div#singleItemDescription>div>table>tbody');

            function buildLinkIIIF(item,parent,child,allChildren,collection,type) {
                //helper function to account for IIIF Prezi vs Image API link references
                let linkContainer = document.createElement('a');
                linkContainer.target = '_blank';
                let linkTarget, rowLabel, rowClass;
                let manifestId, imageId;
                let imgIdStart, slicedString, postIdSlashIndex, actualId;

                // Make sure we don't display the first canvased item if it's not the item that matches the parent
                let img = document.querySelector('.CompoundItemView-thumbnail')

                if(img) {
                    let imgSrc = img.getAttribute('src')
                    //Parse the id from the img's src
                    imgIdStart = imgSrc.indexOf('/id/') + 4
                    slicedString = imgSrc.slice(imgIdStart)
                    postIdSlashIndex = slicedString.indexOf('/')
                    actualId = slicedString.slice(0, postIdSlashIndex)
                } else {
                    // If no cpd item viewer, item is single image.
                    actualId === child
                }

                if (!child) {
                    console.log('no child');
                    manifestId = item;
                    imageId = item;
                } else if (item === parent && actualId === child) {
                    manifestId = item;
                    imageId = child;
                } else {
                    manifestId = parent;
                    imageId = item;
                }

                let shouldCreateLink = false
                if (type === 'manifest') {
                    shouldCreateLink = true
                    linkTarget = `${currentUrl}iiif/info/${collection}/${manifestId}/manifest.json`;
                    linkContainer.title = 'View IIIF Manifest';
                    rowLabel = 'IIIF Manifest';
                    rowClass = 'iiif-manifest-link';
                } else if (type === 'image' && allChildren.includes(imageId)) {
                    shouldCreateLink = true
                    linkTarget = `${currentUrl}digital/iiif/${collection}/${imageId}/full/full/0/default.jpg`;
                    linkContainer.title = 'View IIIF Image';
                    rowLabel = 'IIIF Image';
                    rowClass = 'iiif-image-link';
                }

                if(shouldCreateLink) {
                    linkContainer.href = linkTarget;
                    linkContainer.setAttribute('aria-label',linkContainer.title);
                    linkContainer.innerHTML = logoSvgIIIF + ' ' + linkTarget;
                    let newRow = newMetadataRow(rowClass,rowLabel,linkContainer);
                    return newRow;
                } else {
                    return
                }
            }

            if (!objectDescriptionTable) {
                let singleManifest = buildLinkIIIF(item,parent,child,allChildren,collection,'manifest');
                singleItemDescriptionTable.appendChild(singleManifest);
                let singleImage = buildLinkIIIF(item,parent,child,allChildren,collection,'image');
                singleItemDescriptionTable.appendChild(singleImage);
            }

            if (objectDescriptionTable) {
                let objectManifest = buildLinkIIIF(item,parent,child,allChildren,collection,'manifest');
                objectDescriptionTable.appendChild(objectManifest);
                let objectImage = buildLinkIIIF(item,parent,child,allChildren,collection,'image');
                itemDescriptionTable.appendChild(objectImage);
            }
        },
        removeLink: function() {
            Array.from(document.querySelectorAll('.iiif-manifest-link')).forEach(function(el) {
                if (el && el.parentElement) {
                    el.parentElement.removeChild(el);
                }
            });
            Array.from(document.querySelectorAll('.iiif-image-link')).forEach(function(el) {
                if (el && el.parentElement) {
                    el.parentElement.removeChild(el);
                }
            });
        }
    };

    let globalScope = true;
    let collectionScope = [
    ];


    document.addEventListener('cdm-item-page:ready', function(e){
        let item = e.detail.itemId;
        let collection = e.detail.collectionId;
        if (globalScope || collectionScope.includes(collection)) {
            getParent(item, collection)
            .then(function(response) {
                if (response) {
                    checkManifest(response, collection)
                    .then(function(response) {
                        if (response) {
                            fieldIiifManifest.insertManifestLink(item, response.parent, response.child, response.allChildren, collection);
                        } else {
                            return;
                        }
                    })
                }
            });
        }
    });

    document.addEventListener('cdm-item-page:update', function(e){
        let item = e.detail.itemId;
        let collection = e.detail.collectionId;
        fieldIiifManifest.removeLink();
        if (globalScope || collectionScope.includes(collection)) {
            getParent(item, collection)
            .then(function(response) {
                if (response) {
                    checkManifest(response, collection)
                    .then(function(response) {
                        if (response) {
                            fieldIiifManifest.insertManifestLink(item, response.parent, response.child, response.allChildren, collection);
                        } else {
                            return;
                        }
                    })
                }
            });
        }
    });

    document.addEventListener('cdm-item-page:leave', function(e){
        let collection = e.detail.collectionId;
        if (globalScope || collectionScope.includes(collection)) {
            fieldIiifManifest.removeLink();
        }
    });

})();

/* version history

1.0 - 2019 Dec - initial implementation

*/

/* version history

1.6 - 2021 Aug 13 - fix event timing problems when loading dependencies and simply addEventListener stanzas
1.5 - 2021 Jan 19 - consolidate js to one file and rename main file
1.4 - 2021 Jan 17 - added check for single item pdfs; changed http check to '!= 200'
                  - refactored fetch calls to arrow functions; converted to template literals
1.3 - 2020 Aug 31 - fixed typo in manifest URL
1.2 - 2020 August - changed URL pattern for manifest request
1.1 - 2019 June - updated with global vs. collection toggle options
1.0 - 2019 May - initial implementation

*/
