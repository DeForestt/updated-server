# Use the latest Ubuntu image
FROM ubuntu:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    cmake \
    git \
    libboost-all-dev \
    bash \
    sudo \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Clone and build AFlat using the official workflow
ENV AFLAT_ROOT=/root/.aflat/aflat
RUN mkdir -p /root/.aflat \
    && git clone https://github.com/DeForestt/aflat.git ${AFLAT_ROOT}

RUN cmake -S ${AFLAT_ROOT} -B ${AFLAT_ROOT}/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build ${AFLAT_ROOT}/build --target aflat \
    && cd ${AFLAT_ROOT} && bash rebuild-libs.sh

ENV PATH=${AFLAT_ROOT}/bin:$PATH

# Prepare the project directory
RUN mkdir /project
WORKDIR /project

# Copy project files
COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port 8080 for the AFlat server
EXPOSE 8080

# Build the project with the freshly built aflat
RUN aflat build

# Set the entry point to run the Aflat project
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD []
