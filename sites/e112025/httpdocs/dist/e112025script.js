function populateImages(template, container, isAuth) {
    fetch('/upload-log-read')
        .then(res => res.json())
        .then(d => {
            for (const key in d) {
                const clone = template.content.cloneNode(true);

                clone.querySelector('h3').textContent = d[key].caption;

                console.log(isAuth)
                if (isAuth) {
                    clone.querySelector('button').classList.add("d-block");
                    clone.querySelector('button').addEventListener('click', (event) => {
                        fetch('/upload-log-delete/' + key, {
                                method: 'POST',
                            })
                            .then()
                            .then(data => {
                                location.reload(true);
                            })
                            .catch(error => console.error('Error:', error));
                    });
                } else {
                    clone.querySelector('button').classList.add("d-none");
                }

                d[key].paths.forEach(element => {
                    const img = document.createElement('img');
                    const anchor = document.createElement('a');
                    img.src = element;
                    anchor.href = element;
                    img.classList.add('gallery-image');
                    anchor.appendChild(img);
                    clone.querySelector('span').appendChild(anchor);
                });
                container.appendChild(clone);
            }
        });
}